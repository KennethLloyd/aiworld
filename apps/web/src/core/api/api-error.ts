import type { core } from 'zod';

/**
 * The backend normalizes every non-2xx response into the envelope
 * { statusCode, message, error }: 400 validation errors carry a ZodIssue[] in
 * `message`, all other errors carry a string. TypeScript forbids widening
 * Error.message (TS2416), so the raw payload is kept on `issues` and `message`
 * holds the human-readable string form; `toUserMessage()` renders whichever
 * text the UI should surface.
 */
export type ApiErrorMessage = string | readonly core.$ZodIssue[];

export class ApiError extends Error {
  readonly status: number;
  readonly error: string;
  readonly issues: readonly core.$ZodIssue[];

  constructor(status: number, payload: ApiErrorMessage, error: string) {
    super(
      typeof payload === 'string'
        ? payload
        : payload.map((issue) => issue.message).join(', '),
    );
    this.name = 'ApiError';
    this.status = status;
    this.error = error;
    this.issues = typeof payload === 'string' ? [] : payload;
  }

  toUserMessage(): string {
    if (this.issues.length > 0) {
      return this.issues.map((issue) => issue.message).join(', ');
    }
    return this.message;
  }
}

interface ErrorEnvelope {
  statusCode?: unknown;
  message?: unknown;
  error?: unknown;
}

function isErrorEnvelope(value: unknown): value is ErrorEnvelope {
  return (
    typeof value === 'object' &&
    value !== null &&
    'statusCode' in value &&
    'message' in value
  );
}

function isZodIssueLike(value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { message?: unknown }).message === 'string'
  );
}

function parseMessage(value: unknown): ApiErrorMessage {
  if (typeof value === 'string') {
    return value;
  }
  // 400 validation errors: message is the ZodValidationPipe's ZodIssue[].
  if (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((issue) => isZodIssueLike(issue))
  ) {
    return value as readonly core.$ZodIssue[];
  }
  return 'Request failed';
}

/**
 * Builds an ApiError from the { statusCode, message, error } envelope. When
 * the body is not the envelope (should not happen for /api routes thanks to
 * the HttpExceptionFilter), it falls back to a generic HttpError.
 */
export function parseErrorEnvelope(status: number, raw: unknown): ApiError {
  if (isErrorEnvelope(raw)) {
    return new ApiError(
      status,
      parseMessage(raw.message),
      typeof raw.error === 'string' ? raw.error : 'HttpError',
    );
  }
  return new ApiError(status, 'Request failed', 'HttpError');
}
