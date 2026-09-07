import { ProviderError } from '@/lib/llm/provider-error';
import { SimulationActionError } from '@/simulation/actions/simulation-action.error';

/** Errors specific to composing a simulation iteration. */
export class SimulationIterationPickError extends Error {
  constructor(
    public readonly code: 'NO_ACTIVE_CHARACTERS',
    message: string,
  ) {
    super(message);
    this.name = 'SimulationIterationPickError';
  }
}

/** Custom actor is not an active AI member of the target World. */
export class SimulationCharacterNotActiveError extends Error {
  constructor(characterId: string, worldSlug: string) {
    super(
      `Character "${characterId}" is not an active member of World "${worldSlug}"`,
    );
    this.name = 'SimulationCharacterNotActiveError';
  }
}

/** Prisma codes treated as transient database failures. */
const transientDatabaseErrorCodes = new Set([
  'P1001', // cannot reach the database server
  'P1008', // operations timed out
  'P1017', // server closed the connection
  'P2024', // query timed out
]);

function errorCodeOf(error: unknown): unknown {
  return typeof error === 'object' && error !== null
    ? (error as { code?: unknown }).code
    : undefined;
}

function errorNameOf(error: unknown): string {
  return typeof error === 'object' && error !== null && error instanceof Error
    ? error.name
    : '';
}

/** Classifies errors for scheduler retry or dead-letter handling. */
export function isTransientSchedulerError(error: unknown): boolean {
  if (
    error instanceof ProviderError ||
    error instanceof SimulationActionError
  ) {
    return error.retryable;
  }

  const code = errorCodeOf(error);
  if (typeof code === 'string' && transientDatabaseErrorCodes.has(code)) {
    return true;
  }

  return /ECONN|timeout|Timeout|Abort/i.test(errorNameOf(error));
}
