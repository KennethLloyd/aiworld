import { ProviderError, ProviderErrorCode } from '@/lib/llm/provider-error';

export const simulationActionErrorCodes = [
  'WORLD_NOT_FOUND',
  'CHARACTER_INACTIVE',
  'MEMBER_NOT_FOUND',
  'POST_NOT_FOUND',
] as const;
export type SimulationActionErrorCode =
  (typeof simulationActionErrorCodes)[number];

export type ActionFailureCode = ProviderErrorCode | SimulationActionErrorCode;

export type ActionFailure = {
  code: ActionFailureCode;
  message: string;
  retryable: boolean;
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

function toFailure(
  code: ActionFailureCode,
  message: string,
  retryable: boolean,
): ActionFailure {
  return { code, message, retryable };
}

export function toActionFailure(error: unknown): ActionFailure {
  if (
    error instanceof ProviderError ||
    error instanceof SimulationActionError
  ) {
    return toFailure(error.code, error.message, error.retryable);
  }

  const message =
    error instanceof Error ? error.message : 'Unknown action failure';
  return toFailure('UNKNOWN', message, false);
}
