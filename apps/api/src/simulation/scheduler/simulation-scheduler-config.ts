import { z } from 'zod';

export const SCHEDULER_CONFIG = 'SCHEDULER_CONFIG';

export type SchedulerConfig = {
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

/** Empty environment strings use the schema defaults. */
function envValue(value: string | undefined): string | undefined {
  return value !== undefined && value.trim() === '' ? undefined : value;
}

const schedulerConfigInputSchema = z.object({
  redisUrl: z.string().min(1).default('redis://localhost:6379'),
  maxAttempts: z.coerce.number().int().min(1).max(10).default(3),
  retryBaseDelayMs: z.coerce.number().int().min(0).max(60_000).default(1000),
});

export function loadSchedulerConfig(
  env: Record<string, string | undefined> = process.env,
): SchedulerConfig {
  const parsed = schedulerConfigInputSchema.safeParse({
    redisUrl: envValue(env.REDIS_URL),
    maxAttempts: envValue(env.SCHEDULER_MAX_ATTEMPTS),
    retryBaseDelayMs: envValue(env.SCHEDULER_RETRY_BASE_DELAY_MS),
  });

  if (!parsed.success) {
    throw new SchedulerConfigurationError('Invalid scheduler configuration');
  }

  return parsed.data;
}
