import { z } from 'zod';

export const schedulerAdapterIds = ['bullmq', 'in-process'] as const;
export type SchedulerAdapterId = (typeof schedulerAdapterIds)[number];

export const SCHEDULER_CONFIG = 'SCHEDULER_CONFIG';

export type SchedulerConfig = {
  adapterId: SchedulerAdapterId;
  redisUrl: string;
  maxAttempts: number;
  retryBaseDelayMs: number;
};

export class SchedulerConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SchedulerConfigurationError';
  }
}

/** Mirror of provider-config.ts: empty environment strings are treated as
 * absent so a `.env` line like `SCHEDULER_ADAPTER=` falls back to the default
 * instead of failing validation, and invalid values fail fast at boot. */
function envValue(value: string | undefined): string | undefined {
  return value !== undefined && value.trim() === '' ? undefined : value;
}

const schedulerConfigInputSchema = z.object({
  adapterId: z.enum(schedulerAdapterIds).default('bullmq'),
  redisUrl: z.string().min(1).default('redis://localhost:6379'),
  maxAttempts: z.coerce.number().int().min(1).max(10).default(3),
  retryBaseDelayMs: z.coerce.number().int().min(0).max(60_000).default(1000),
});

export function loadSchedulerConfig(
  env: Record<string, string | undefined> = process.env,
): SchedulerConfig {
  const parsed = schedulerConfigInputSchema.safeParse({
    adapterId: envValue(env.SCHEDULER_ADAPTER),
    redisUrl: envValue(env.REDIS_URL),
    maxAttempts: envValue(env.SCHEDULER_MAX_ATTEMPTS),
    retryBaseDelayMs: envValue(env.SCHEDULER_RETRY_BASE_DELAY_MS),
  });

  if (!parsed.success) {
    throw new SchedulerConfigurationError('Invalid scheduler configuration');
  }

  return parsed.data;
}
