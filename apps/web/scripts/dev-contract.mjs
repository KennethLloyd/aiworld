import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { afterEach, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const webRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const workspaceRoot = resolve(webRoot, '../..');
const pnpmCommand = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const children = new Set();

function startProcess(args, cwd) {
  const child = spawn(pnpmCommand, args, {
    cwd,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  children.add(child);
  return child;
}

function stopProcess(child) {
  if (
    child.exitCode !== null ||
    child.signalCode !== null ||
    child.pid === undefined
  ) {
    return;
  }

  try {
    process.kill(-child.pid, 'SIGTERM');
  } catch {
    child.kill('SIGTERM');
  }
}

function waitForExit(child, timeoutMs = 5_000) {
  if (child.exitCode !== null) {
    return Promise.resolve({ code: child.exitCode, signal: child.signalCode });
  }

  return Promise.race([
    once(child, 'exit').then(([code, signal]) => ({ code, signal })),
    new Promise((_, reject) => {
      setTimeout(
        () => reject(new Error('Timed out waiting for process exit.')),
        timeoutMs,
      );
    }),
  ]);
}

async function getFreePort() {
  const server = createServer();
  await new Promise((resolveListen, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolveListen);
  });
  const { port } = server.address();
  await new Promise((resolveClose) => server.close(resolveClose));
  return port;
}

async function waitForHttp(url, timeoutMs = 5_000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // The process may still be starting.
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 50));
  }

  throw new Error(`Timed out waiting for ${url}.`);
}

afterEach(() => {
  for (const child of children) stopProcess(child);
  children.clear();
});

test('declares a Turbo API relationship and waits for readiness', async () => {
  const [rootTurbo, webTurbo, webPackage] = await Promise.all([
    readFile(resolve(workspaceRoot, 'turbo.json'), 'utf8'),
    readFile(resolve(webRoot, 'turbo.json'), 'utf8'),
    readFile(resolve(webRoot, 'package.json'), 'utf8'),
  ]);
  const rootConfig = JSON.parse(rootTurbo);
  const webConfig = JSON.parse(webTurbo);
  const packageConfig = JSON.parse(webPackage);

  assert.equal(rootConfig.tasks.dev.persistent, true);
  assert.deepEqual(webConfig.tasks.dev.with, ['@aiworld/api#dev']);
  assert.match(
    packageConfig.scripts.dev,
    /^wait-on --timeout 60000 http-get:\/\/localhost:3000\/api\/docs && vite$/,
  );

  let ready = false;
  const api = createServer((_request, response) => {
    response.statusCode = ready ? 200 : 503;
    response.end();
  });
  await new Promise((resolveListen, reject) => {
    api.once('error', reject);
    api.listen(0, '127.0.0.1', resolveListen);
  });
  const { port } = api.address();
  const readiness = startProcess(
    [
      'exec',
      'wait-on',
      '--timeout',
      '3000',
      `http-get://127.0.0.1:${port}/api/docs`,
    ],
    webRoot,
  );

  await new Promise((resolveDelay) => setTimeout(resolveDelay, 250));
  assert.equal(readiness.exitCode, null);
  ready = true;
  assert.deepEqual(await waitForExit(readiness), { code: 0, signal: null });
  await new Promise((resolveClose) => api.close(resolveClose));
});

test('fails a duplicate Vite server instead of selecting another port', async () => {
  const port = await getFreePort();
  const first = startProcess(
    ['exec', 'vite', '--host', '127.0.0.1', '--port', String(port)],
    webRoot,
  );
  await waitForHttp(`http://127.0.0.1:${port}`);

  const second = startProcess(
    ['exec', 'vite', '--host', '127.0.0.1', '--port', String(port)],
    webRoot,
  );
  const output = [];
  second.stdout.on('data', (chunk) => output.push(chunk.toString()));
  second.stderr.on('data', (chunk) => output.push(chunk.toString()));
  const result = await waitForExit(second);

  assert.notEqual(result.code, 0);
  assert.match(output.join(''), /already in use/i);
  stopProcess(first);
});
