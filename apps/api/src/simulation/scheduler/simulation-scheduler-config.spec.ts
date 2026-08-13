import {
  loadSchedulerConfig,
  SchedulerConfigurationError,
} from '@/simulation/scheduler/simulation-scheduler-config';

describe('loadSchedulerConfig', () => {
  it('defaults to the bullmq adapter', () => {
    expect(loadSchedulerConfig({}).adapterId).toBe('bullmq');
  });

  it('selects the in-process adapter for tests and offline use', () => {
    expect(
      loadSchedulerConfig({ SCHEDULER_ADAPTER: 'in-process' }).adapterId,
    ).toBe('in-process');
  });

  it('treats an empty adapter value as absent', () => {
    expect(loadSchedulerConfig({ SCHEDULER_ADAPTER: '' }).adapterId).toBe(
      'bullmq',
    );
  });

  it('fails fast on an unknown adapter value', () => {
    expect(() => loadSchedulerConfig({ SCHEDULER_ADAPTER: 'kafka' })).toThrow(
      SchedulerConfigurationError,
    );
  });

  it('reads the redis url and retry tuning', () => {
    const config = loadSchedulerConfig({
      REDIS_URL: 'redis://cache:6380',
      SCHEDULER_MAX_ATTEMPTS: '5',
      SCHEDULER_RETRY_BASE_DELAY_MS: '2000',
    });

    expect(config.redisUrl).toBe('redis://cache:6380');
    expect(config.maxAttempts).toBe(5);
    expect(config.retryBaseDelayMs).toBe(2000);
  });

  it('coerces numeric tuning and falls back when empty', () => {
    expect(
      loadSchedulerConfig({ SCHEDULER_MAX_ATTEMPTS: '' }).maxAttempts,
    ).toBe(3);
    expect(
      loadSchedulerConfig({ SCHEDULER_RETRY_BASE_DELAY_MS: '' })
        .retryBaseDelayMs,
    ).toBe(1000);
  });

  it('fails fast on invalid tuning values', () => {
    expect(() => loadSchedulerConfig({ SCHEDULER_MAX_ATTEMPTS: '0' })).toThrow(
      SchedulerConfigurationError,
    );
    expect(() =>
      loadSchedulerConfig({ SCHEDULER_RETRY_BASE_DELAY_MS: '-1' }),
    ).toThrow(SchedulerConfigurationError);
    expect(loadSchedulerConfig({ REDIS_URL: '' }).redisUrl).toBe(
      'redis://localhost:6379',
    );
  });
});
