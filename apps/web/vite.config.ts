import { fileURLToPath, URL } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

// Resolve shared package imports from source during development and tests.
const sharedSourceRoot = '../../packages/shared/src';
const defaultFrontendPort = 5173;
const defaultApiPort = 3000;

function parsePort(value: string | undefined, fallback: number, name: string) {
  if (!value?.trim()) {
    return fallback;
  }

  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`${name} must be an integer between 1 and 65535.`);
  }

  return port;
}

export function resolveDevPorts(env: Record<string, string | undefined>) {
  return {
    frontendPort: parsePort(env.VITE_PORT, defaultFrontendPort, 'VITE_PORT'),
    apiPort: parsePort(env.VITE_API_PORT, defaultApiPort, 'VITE_API_PORT'),
  };
}

export function createDevServerOptions(
  env: Record<string, string | undefined>,
) {
  const { frontendPort, apiPort } = resolveDevPorts(env);

  return {
    port: frontendPort,
    strictPort: true,
    proxy: {
      '/api': { target: `http://localhost:${apiPort}`, changeOrigin: true },
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd()), ...process.env };

  return {
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
    server: createDevServerOptions(env),
  };
});
