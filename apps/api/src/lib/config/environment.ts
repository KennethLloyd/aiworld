import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

import { resolveAppPorts, type AppPorts } from '@aiworld/shared/config/ports';
import { config as loadDotenv } from 'dotenv';

export interface AppConfig extends AppPorts {
  betterAuthUrl: string;
  frontendOrigins: string[];
}

const repositoryRoot = findRepositoryRoot(process.cwd());
loadDotenv({ path: join(repositoryRoot, '.env'), quiet: true });

export function resolveAppConfig(
  env: Record<string, string | undefined> = process.env,
): AppConfig {
  // Deployment platforms commonly provide PORT; local development uses API_PORT.
  const configuredApiPort = env.API_PORT?.trim() || env.PORT;
  const ports = resolveAppPorts({
    ...env,
    API_PORT: configuredApiPort,
  });
  const configuredFrontendOrigins = parseOrigins(env.FRONTEND_ORIGIN);

  return {
    ...ports,
    betterAuthUrl: env.BETTER_AUTH_URL?.trim() || ports.apiOrigin,
    frontendOrigins:
      configuredFrontendOrigins.length > 0
        ? configuredFrontendOrigins
        : [ports.webOrigin],
  };
}

export const appConfig = resolveAppConfig();

function parseOrigins(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

function findRepositoryRoot(startDirectory: string): string {
  let directory = resolve(startDirectory);

  while (true) {
    if (existsSync(join(directory, 'pnpm-workspace.yaml'))) {
      return directory;
    }

    const parentDirectory = dirname(directory);
    if (parentDirectory === directory) {
      return resolve(startDirectory);
    }
    directory = parentDirectory;
  }
}
