import { ProviderError, ProviderErrorCode } from '@/lib/llm/provider-error';

export const simulationActionErrorCodes = [
  'WORLD_NOT_FOUND',
  'CHARACTER_INACTIVE',
  'MEMBER_NOT_FOUND',
  'POST_NOT_FOUND',
  'COMMENT_PARENT_NOT_FOUND',
  'COMMENT_PARENT_POST_MISMATCH',
  'COMMENT_DEPTH_EXCEEDED',
  'NO_ACTIVE_TARGET',
  'UNSAFE_OUTPUT',
] as const;
export type SimulationActionErrorCode =
  (typeof simulationActionErrorCodes)[number];

export type ActionFailureCode = ProviderErrorCode | SimulationActionErrorCode;

export type ActionFailure = {
  code: ActionFailureCode;
  message: string;
  retryable: boolean;
  providerFailure?: boolean;
};

export class SimulationActionError extends Error {
  constructor(
    public readonly code: SimulationActionErrorCode,
    message: string,
    public readonly retryable = false,
  ) {
    super(message);
    this.name = 'SimulationActionError';
  }
}

/** A write-path rejection (for example a comment deeper than three levels).
 * Subclasses SimulationActionError so the shared failure mapper handles it. */
export class SimulationWriteError extends SimulationActionError {}

/** A provider returned syntactically valid data that is not safe to publish.
 * Keeping this separate from MALFORMED_RESPONSE makes operator logs useful
 * without exposing provider payloads to the public API. */
export class SimulationOutputSafetyError extends SimulationActionError {
  constructor(message: string) {
    super('UNSAFE_OUTPUT', message);
    this.name = 'SimulationOutputSafetyError';
  }
}
function toFailure(
  code: ActionFailureCode,
  message: string,
  retryable: boolean,
  providerFailure?: boolean,
): ActionFailure {
  return providerFailure === undefined
    ? { code, message, retryable }
    : { code, message, retryable, providerFailure };
}

export function toActionFailure(error: unknown): ActionFailure {
  if (error instanceof ProviderError) {
    return toFailure(error.code, error.message, error.retryable, true);
  }
  if (error instanceof SimulationActionError) {
    return toFailure(error.code, error.message, error.retryable);
  }

  return toFailure('UNKNOWN', 'Simulation action failed', false);
}
