import {
  ProviderCapabilityError,
  ProviderMalformedResponseError,
  ProviderError,
  mapProviderError,
} from './provider-error.js';

describe('mapProviderError', () => {
  it.each([
    [401, 'AUTHENTICATION', false],
    [403, 'AUTHENTICATION', false],
    [408, 'TIMEOUT', true],
    [429, 'RATE_LIMIT', true],
    [503, 'NETWORK', true],
  ] as const)('maps HTTP status %s to %s', (statusCode, code, retryable) => {
    expect(
      mapProviderError({ statusCode, message: 'provider detail' }),
    ).toMatchObject({
      code,
      retryable,
      statusCode,
    });
  });

  it('maps abort and network errors without leaking provider details', () => {
    const timeout = Object.assign(new Error('secret request detail'), {
      name: 'AbortError',
    });
    const network = Object.assign(new Error('secret network detail'), {
      code: 'ECONNRESET',
    });

    expect(mapProviderError(timeout)).toMatchObject({
      code: 'TIMEOUT',
      retryable: true,
    });
    expect(mapProviderError(network)).toMatchObject({
      code: 'NETWORK',
      retryable: true,
    });
  });

  it('preserves already-classified provider errors', () => {
    const error = new ProviderMalformedResponseError('safe parse failure');

    expect(mapProviderError(error)).toBe(error);
    expect(error).toBeInstanceOf(ProviderError);
  });

  it('preserves explicit capability errors as non-retryable', () => {
    const error = new ProviderCapabilityError(
      'JSON schema output is unavailable',
    );

    expect(mapProviderError(error)).toMatchObject({
      code: 'CAPABILITY',
      retryable: false,
    });
  });

  it('maps unknown errors to a non-retryable safe error', () => {
    expect(mapProviderError(new Error('provider detail'))).toMatchObject({
      code: 'UNKNOWN',
      retryable: false,
      message: 'provider detail',
    });
  });
});
