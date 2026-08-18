import { spawn } from "node:child_process";

const apiReadyUrl = "http://localhost:3000/api/docs";
const children = new Set();
let shuttingDown = false;

function startWorkspace(args, { captureOutput = false } = {}) {
  const child = spawn("pnpm", args, {
    detached: true,
    env: process.env,
    stdio: captureOutput ? ["inherit", "pipe", "pipe"] : "inherit",
  });
  if (captureOutput) {
    child.stdout.on("data", (chunk) => process.stdout.write(chunk));
    child.stderr.on("data", (chunk) => process.stderr.write(chunk));
  }
  children.add(child);
  return child;
}

function waitForApi(apiProcess) {
  return new Promise((resolve, reject) => {
    let output = "";
    const timer = setTimeout(() => {
      reject(new Error(`Timed out waiting for the API at ${apiReadyUrl}.`));
    }, 60_000);

    const finish = (callback, value) => {
      clearTimeout(timer);
      callback(value);
    };

    apiProcess.stdout.on("data", (chunk) => {
      output = `${output}${chunk}`.slice(-256);
      if (output.includes("Server is running on http://localhost:3000")) {
        finish(resolve);
      }
    });
    apiProcess.stderr.on("data", (chunk) => {
      const errorOutput = chunk.toString();
      if (errorOutput.includes("EADDRINUSE") || errorOutput.includes("Error: listen")) {
        finish(reject, new Error("API could not bind to http://localhost:3000."));
      }
    });
    apiProcess.once("exit", (code) => {
      finish(
        reject,
        new Error(`API exited before readiness check completed (code ${code ?? "unknown"}).`),
      );
    });
  });
}

function waitForExit(processes) {
  return Promise.race(
    processes.map(
      (child) =>
        new Promise((resolve) => {
          child.once("exit", (code, signal) => resolve({ code, signal }));
        }),
    ),
  );
}

function stop(child) {
  if (child.pid === undefined || child.killed) return;
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    child.kill("SIGTERM");
  }
}

function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) stop(child);
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);

try {
  const api = startWorkspace(["--filter", "@aiworld/api", "dev"], {
    captureOutput: true,
  });
  await waitForApi(api);
  console.log("[dev] API ready; starting Vite.");
  const web = startWorkspace(["--filter", "@aiworld/web", "dev"]);
  await waitForExit([api, web]);
} catch (error) {
  console.error(`[dev] ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
} finally {
  shutdown();
}
