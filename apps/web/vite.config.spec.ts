import { describe, expect, it } from 'vitest';

import { createDevServerOptions, resolveDevPorts } from './vite.config';

describe('development server ports', () => {
  it('uses the standard development defaults', () => {
    expect(resolveDevPorts({})).toEqual({
      frontendPort: 5173,
      apiPort: 3000,
    });
  });

  it('uses the configured frontend and API ports', () => {
    expect(
      createDevServerOptions({
        AIWORLD_WEB_PORT: '5174',
        AIWORLD_API_PORT: '3001',
      }),
    ).toMatchObject({
      port: 5174,
      proxy: {
        '/api': {
          target: 'http://localhost:3001',
        },
      },
    });
  });

  it('rejects invalid configured ports', () => {
    expect(() => resolveDevPorts({ AIWORLD_WEB_PORT: 'not-a-port' })).toThrow(
      'AIWORLD_WEB_PORT must be an integer between 1 and 65535.',
    );
  });
});
