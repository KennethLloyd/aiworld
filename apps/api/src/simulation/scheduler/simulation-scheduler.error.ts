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

/** A custom action named a Character that is not an active AI member of the
 * target World. A client input error: the request must be rejected before any
 * command is composed, never silently logged as a failed run. */
export class SimulationCharacterNotActiveError extends Error {
  constructor(characterId: string, worldSlug: string) {
    super(
      `Character "${characterId}" is not an active member of World "${worldSlug}"`,
    );
    this.name = 'SimulationCharacterNotActiveError';
  }
}

/** Prisma error codes that mean "the database was unreachable or too slow",
 * not "your data was wrong" — the transient class of the retry contract. */
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

/** Transient errors back off and retry; permanent errors never retry. The
 * provider and action error classes already carry their own `retryable` flag
 * (LLM timeout/5xx/rate-limit retry; validation and unknown world/character do
 * not). Raw infrastructure errors — for example a database connection blip on
 * the write path — are classified here so they get the same backoff instead of
 * being dead-lettered on the first hiccup. */
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
