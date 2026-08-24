import { fileURLToPath, URL } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Match Vite aliases so tests resolve the shared package like the app.
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
    // Limit discovery to apps/web when tests run from the repository root.
    root: fileURLToPath(new URL('.', import.meta.url)),
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
    },
  },
});
