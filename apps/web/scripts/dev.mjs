import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { loadEnv } from 'vite';
import waitOn from 'wait-on';

const webRoot = fileURLToPath(new URL('../', import.meta.url));
const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
const env = {
  ...loadEnv('development', webRoot, ''),
  ...loadEnv('development', repoRoot, ''),
  ...process.env,
};
const apiPort = env.PORT ?? env.VITE_API_PORT ?? '3000';

await waitOn({
  resources: [`http://localhost:${apiPort}/api/docs`],
  timeout: 60_000,
});

const viteCommand = process.platform === 'win32' ? 'vite.cmd' : 'vite';
const vite = spawn(viteCommand, [], { env, stdio: 'inherit' });

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => vite.kill(signal));
}

vite.once('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
