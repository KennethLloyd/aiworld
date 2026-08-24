export const DEFAULT_API_PORT = 3000;
export const DEFAULT_WEB_PORT = 5173;

export interface PortEnvironment {
  API_PORT?: string | undefined;
  WEB_PORT?: string | undefined;
}

export interface AppPorts {
  apiPort: number;
  webPort: number;
  apiOrigin: string;
  webOrigin: string;
}

export function resolveAppPorts(env: PortEnvironment): AppPorts {
  const apiPort = resolvePort('API_PORT', env.API_PORT, DEFAULT_API_PORT);
  const webPort = resolvePort('WEB_PORT', env.WEB_PORT, DEFAULT_WEB_PORT);

  return {
    apiPort,
    webPort,
    apiOrigin: getLocalOrigin(apiPort),
    webOrigin: getLocalOrigin(webPort),
  };
}

export function getLocalOrigin(port: number): string {
  return `http://localhost:${port}`;
}

function resolvePort(name: string, value: string | undefined, fallback: number): number {
  const trimmedValue = value?.trim();
  if (!trimmedValue) {
    return fallback;
  }

  const port = Number(trimmedValue);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`${name} must be an integer between 1 and 65535.`);
  }

  return port;
}
