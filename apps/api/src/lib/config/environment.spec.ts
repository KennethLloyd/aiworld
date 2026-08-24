import { resolveAppConfig } from './environment';

describe('resolveAppConfig', () => {
  it('derives the default local origins from the default ports', () => {
    expect(resolveAppConfig({})).toMatchObject({
      apiPort: 3000,
      webPort: 5173,
      apiOrigin: 'http://localhost:3000',
      webOrigin: 'http://localhost:5173',
      betterAuthUrl: 'http://localhost:3000',
      frontendOrigins: ['http://localhost:5173'],
    });
  });

  it('derives the API origin from a custom API_PORT', () => {
    expect(
      resolveAppConfig({ API_PORT: '4000', WEB_PORT: '5173' }),
    ).toMatchObject({
      apiPort: 4000,
      apiOrigin: 'http://localhost:4000',
      betterAuthUrl: 'http://localhost:4000',
      webOrigin: 'http://localhost:5173',
      frontendOrigins: ['http://localhost:5173'],
    });
  });

  it('uses a platform PORT only when API_PORT is not set', () => {
    expect(resolveAppConfig({ PORT: '4500' }).apiPort).toBe(4500);
    expect(resolveAppConfig({ API_PORT: '4000', PORT: '4500' }).apiPort).toBe(
      4000,
    );
  });

  it('derives the trusted frontend origin from a custom WEB_PORT', () => {
    expect(
      resolveAppConfig({ API_PORT: '3000', WEB_PORT: '5174' }),
    ).toMatchObject({
      apiOrigin: 'http://localhost:3000',
      betterAuthUrl: 'http://localhost:3000',
      webPort: 5174,
      webOrigin: 'http://localhost:5174',
      frontendOrigins: ['http://localhost:5174'],
    });
  });

  it('uses deployment URL overrides without changing derived ports', () => {
    expect(
      resolveAppConfig({
        API_PORT: '4000',
        WEB_PORT: '5174',
        BETTER_AUTH_URL: 'https://api.example.com',
        FRONTEND_ORIGIN: 'https://example.com, https://admin.example.com',
      }),
    ).toMatchObject({
      apiOrigin: 'http://localhost:4000',
      webOrigin: 'http://localhost:5174',
      betterAuthUrl: 'https://api.example.com',
      frontendOrigins: ['https://example.com', 'https://admin.example.com'],
    });
  });

  it('rejects invalid ports instead of silently falling back', () => {
    expect(() => resolveAppConfig({ API_PORT: 'not-a-port' })).toThrow(
      'API_PORT must be an integer between 1 and 65535.',
    );
  });
});
