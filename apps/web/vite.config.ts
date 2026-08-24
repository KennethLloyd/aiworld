import { fileURLToPath, URL } from 'node:url';

import { resolveAppPorts } from '@aiworld/shared/config/ports';
import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

// Resolve shared package imports from source during development and tests.
const sharedSourceRoot = '../../packages/shared/src';
const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, repositoryRoot, ['API_', 'WEB_']);
  const { apiOrigin, webPort } = resolveAppPorts(env);

  return {
    envDir: repositoryRoot,
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
      port: webPort,
      strictPort: true,
      proxy: {
        '/api': { target: apiOrigin, changeOrigin: true },
      },
    },
  };
});
