export const providerErrorCodes = [
  'AUTHENTICATION',
  'TIMEOUT',
  'RATE_LIMIT',
  'MALFORMED_RESPONSE',
  'CAPABILITY',
  'NETWORK',
  'UNKNOWN',
] as const;

export type ProviderErrorCode = (typeof providerErrorCodes)[number];

export class ProviderError extends Error {
  constructor(
    public readonly code: ProviderErrorCode,
    message: string,
    public readonly retryable: boolean,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

export class ProviderConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProviderConfigurationError';
  }
}

export class ProviderMalformedResponseError extends ProviderError {
  constructor(message: string) {
    super('MALFORMED_RESPONSE', message, false);
    this.name = 'ProviderMalformedResponseError';
  }
}

export class ProviderCapabilityError extends ProviderError {
  constructor(message: string) {
    super('CAPABILITY', message, false);
    this.name = 'ProviderCapabilityError';
  }
}

type ErrorLike = {
  code?: unknown;
  message?: unknown;
  name?: unknown;
  status?: unknown;
  statusCode?: unknown;
};

function toErrorLike(value: unknown): ErrorLike {
  if (typeof value !== 'object' || value === null) {
    return {};
  }

  return value as ErrorLike;
}

function getStatusCode(error: ErrorLike): number | undefined {
  const candidate = error.statusCode ?? error.status;
  return typeof candidate === 'number' ? candidate : undefined;
}

export function mapProviderError(error: unknown): ProviderError {
  if (error instanceof ProviderError) {
    return error;
  }

  const details = toErrorLike(error);
  const message =
    typeof details.message === 'string'
      ? details.message
      : 'Provider request failed';
  const name = typeof details.name === 'string' ? details.name : '';
  const code = typeof details.code === 'string' ? details.code : '';
  const statusCode = getStatusCode(details);

  if (statusCode === 401 || statusCode === 403) {
    return new ProviderError(
      'AUTHENTICATION',
      'Provider authentication failed',
      false,
      statusCode,
    );
  }

  if (
    statusCode === 408 ||
    name === 'AbortError' ||
    name === 'TimeoutError' ||
    code === 'ETIMEDOUT'
  ) {
    return new ProviderError(
      'TIMEOUT',
      'Provider request timed out',
      true,
      statusCode,
    );
  }

  if (statusCode === 429) {
    return new ProviderError(
      'RATE_LIMIT',
      'Provider rate limit exceeded',
      true,
      statusCode,
    );
  }

  if (statusCode !== undefined && statusCode >= 500) {
    return new ProviderError(
      'NETWORK',
      'Provider service is unavailable',
      true,
      statusCode,
    );
  }

  if (
    code === 'ENOTFOUND' ||
    code === 'ECONNRESET' ||
    code === 'ECONNREFUSED'
  ) {
    return new ProviderError(
      'NETWORK',
      'Provider network request failed',
      true,
    );
  }

  return new ProviderError('UNKNOWN', message, false, statusCode);
}
