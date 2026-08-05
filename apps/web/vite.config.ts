import { fileURLToPath, URL } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Shared raw-source alias (must be declared before the package root so
// subpath imports like @aiworld/shared/schemas/* resolve to .ts source).
const sharedSourceRoot = '../../packages/shared/src';

export default defineConfig({
  plugins: [
    tanstackRouter({
      target: 'react',
      routesDirectory: './src/routes',
      generatedRouteTree: './src/router/routeTree.gen.ts',
    }),
    react(),
    tailwindcss(),
  ],
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
  optimizeDeps: {
    exclude: ['@aiworld/shared'],
  },
  build: {
    outDir: 'dist',
  },
  server: {
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
});
