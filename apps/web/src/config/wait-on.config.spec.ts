import { createRequire } from 'node:module';
import { resolve } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const configPath = resolve(process.cwd(), 'wait-on.config.cjs');
const originalApiHost = process.env.API_HOST;
const originalApiPort = process.env.API_PORT;

afterEach(() => {
  if (originalApiHost === undefined) {
    delete process.env.API_HOST;
  } else {
    process.env.API_HOST = originalApiHost;
  }
  if (originalApiPort === undefined) {
    delete process.env.API_PORT;
  } else {
    process.env.API_PORT = originalApiPort;
  }
  delete require.cache[configPath];
});

describe('web API readiness configuration', () => {
  it('waits on the Docker API hostname and configured port', () => {
    process.env.API_HOST = 'api';
    process.env.API_PORT = '4300';
    delete require.cache[configPath];

    const config = require(configPath) as { resources: string[] };

    expect(config.resources).toEqual(['http-get://api:4300/api/docs']);
  });

  it('defaults to the host-local API endpoint', () => {
    delete process.env.API_HOST;
    delete process.env.API_PORT;
    delete require.cache[configPath];

    const config = require(configPath) as { resources: string[] };

    expect(config.resources).toEqual(['http-get://localhost:3000/api/docs']);
  });
});
