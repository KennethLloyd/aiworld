import {
  loadSchedulerConfig,
  SchedulerConfigurationError,
} from '@/simulation/scheduler/simulation-scheduler-config';

describe('loadSchedulerConfig', () => {
  it('loads the BullMQ scheduler defaults', () => {
    expect(loadSchedulerConfig({})).toMatchObject({
      redisUrl: 'redis://localhost:6379',
      maxAttempts: 3,
      retryBaseDelayMs: 1000,
    });
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
