import { fileURLToPath, URL } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Keep alias resolution in sync with vite.config.ts so tests resolve the
// shared raw-source package exactly like the app does.
const sharedSourceRoot = '../../packages/shared/src';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: /^@aiworld\/shared\/(.+)$/,
        replacement: fileURLToPath(
          new URL(`${sharedSourceRoot}/$1`, import.meta.url),
        ),
      },
      {
        find: '@aiworld/shared',
        replacement: fileURLToPath(
          new URL(`${sharedSourceRoot}/index.ts`, import.meta.url),
        ),
      },
      {
        find: '@',
        replacement: fileURLToPath(new URL('./src', import.meta.url)),
      },
    ],
  },
  test: {
    // Root the test run at the apps/web directory so that running vitest
    // from the repository root (e.g. via npx vitest run --config
    // apps/web/vitest.config.ts) only discovers apps/web tests.
    root: fileURLToPath(new URL('.', import.meta.url)),
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
    },
  },
});
