import type { SimulationBlockedReason } from '@aiworld/shared/schemas/simulation-health.schema';

export type SimulationRuntimeSignals = {
  pending: boolean;
  workExpected: boolean;
  nextTickAt: Date | null;
  lastTickStartedAt: Date | null;
  lastTickCompletedAt: Date | null;
  retrying: boolean;
  recentRetryCount: number;
  blockedReason: SimulationBlockedReason | null;
  deadLetterCount: number;
  lastDeadLetterAt: Date | null;
  lastDeadLetterReason: string | null;
  bootResumeFailure: {
    occurredAt: Date;
    reason: string;
  } | null;
};

export const RECENT_RETRY_WINDOW_MS = 15 * 60 * 1_000;
