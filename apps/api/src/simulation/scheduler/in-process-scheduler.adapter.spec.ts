import { WorldSimulationConfigRecord } from '@/simulation/lifecycle/domain/world-simulation-config-record';
import { SimulationLifecycleService } from '@/simulation/lifecycle/simulation-lifecycle.service';
import { InProcessSchedulerAdapter } from '@/simulation/scheduler/in-process-scheduler.adapter';
import { SimulationIterationPicker } from '@/simulation/scheduler/simulation-iteration-picker';
import { SimulationRandomSource } from '@/simulation/scheduler/simulation-random-source';
import { SchedulerConfig } from '@/simulation/scheduler/simulation-scheduler-config';
import { SimulationTickRunner } from '@/simulation/scheduler/simulation-tick-runner';
import { WorldRecord } from '@/world/domain/world-record';
import { WorldRepository } from '@/world/repositories/world-repository.interface';

const world: WorldRecord = {
  id: 'world-1',
  name: 'The MBTI House',
  slug: 'mbti-house',
  description: null,
  rules: [],
  topicScope: 'MBTI',
  isActive: true,
  createdAt: new Date('2026-08-01T00:00:00.000Z'),
  updatedAt: new Date('2026-08-01T00:00:00.000Z'),
};

function configRecord(
  overrides: Partial<WorldSimulationConfigRecord> = {},
): WorldSimulationConfigRecord {
  return {
    id: 'config-1',
    worldId: 'world-1',
    state: 'RUNNING',
    speedMultiplier: 1,
    intervalMs: 1800000,
    jitterMs: 300000,
    actionWeights: { POST: 0.2, VOTE: 0.5, COMMENT: 0.3 },
    providerId: 'mock',
    model: 'fixture-model',
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
    updatedAt: new Date('2026-08-01T00:00:00.000Z'),
    ...overrides,
  };
}

function createAdapter(config: Partial<SchedulerConfig> = {}) {
  const lifecycleService = {
    getByWorldId: jest.fn().mockResolvedValue(configRecord()),
  } as unknown as jest.Mocked<SimulationLifecycleService>;

  const worldRepository = {
    findById: jest.fn().mockResolvedValue(world),
  } as unknown as jest.Mocked<WorldRepository>;

  const picker = {
    pickCharacter: jest.fn().mockResolvedValue({
      characterId: 'character-1',
      memberId: 'member-1',
    }),
    pickAction: jest.fn().mockReturnValue('POST'),
  } as unknown as jest.Mocked<SimulationIterationPicker>;

  const tickRunner = {
    runScheduledTick: jest.fn(),
    runManualIteration: jest.fn(),
  } as unknown as jest.Mocked<SimulationTickRunner>;

  const randomSource = {
    next: jest.fn().mockReturnValue(0.5),
  } as unknown as jest.Mocked<SimulationRandomSource>;

  const schedulerConfig: SchedulerConfig = {
    adapterId: 'in-process',
    redisUrl: 'redis://localhost:6379',
    maxAttempts: 3,
    retryBaseDelayMs: 1000,
    ...config,
  };

  const adapter = new InProcessSchedulerAdapter(
    lifecycleService,
    worldRepository,
    picker,
    tickRunner,
    randomSource,
    schedulerConfig,
  );

  return { adapter, lifecycleService, worldRepository, picker, tickRunner };
}

const successResult = {
  status: 'success' as const,
  decision: { action: 'POST' as const },
  log: { id: 'log-1' },
};

describe('InProcessSchedulerAdapter', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('schedules a tick at the derived delay and self-reschedules on completion', async () => {
    const { adapter, tickRunner } = createAdapter();
    tickRunner.runScheduledTick.mockResolvedValue(successResult);

    await adapter.start('world-1');

    expect(tickRunner.runScheduledTick).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1799999);
    expect(tickRunner.runScheduledTick).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1);
    expect(tickRunner.runScheduledTick).toHaveBeenCalledTimes(1);
    expect(tickRunner.runScheduledTick).toHaveBeenCalledWith({
      worldSlug: 'mbti-house',
      characterId: 'character-1',
      actionType: 'POST',
      executionSource: 'scheduled',
    });

    await jest.advanceTimersByTimeAsync(1800000);
    expect(tickRunner.runScheduledTick).toHaveBeenCalledTimes(2);
  });

  it('never runs two ticks at once (next timer starts after completion)', async () => {
    const { adapter, tickRunner } = createAdapter();
    tickRunner.runScheduledTick.mockResolvedValue(successResult);

    await adapter.start('world-1');
    await jest.advanceTimersByTimeAsync(1800000);
    expect(tickRunner.runScheduledTick).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(1799999);
    expect(tickRunner.runScheduledTick).toHaveBeenCalledTimes(1);
  });

  it('does not schedule for a world that is not RUNNING', async () => {
    const { adapter, lifecycleService, tickRunner } = createAdapter();
    lifecycleService.getByWorldId.mockResolvedValue(
      configRecord({ state: 'PAUSED' }),
    );

    await adapter.start('world-1');
    await jest.advanceTimersByTimeAsync(3600000);

    expect(tickRunner.runScheduledTick).not.toHaveBeenCalled();
  });

  it('stop removes the pending tick', async () => {
    const { adapter, tickRunner } = createAdapter();
    tickRunner.runScheduledTick.mockResolvedValue(successResult);

    await adapter.start('world-1');
    await adapter.stop('world-1');
    await jest.advanceTimersByTimeAsync(3600000);

    expect(tickRunner.runScheduledTick).not.toHaveBeenCalled();
  });

  it('retries transient failures with exponential backoff up to maxAttempts', async () => {
    const { adapter, tickRunner } = createAdapter();
    tickRunner.runScheduledTick
      .mockResolvedValueOnce({
        status: 'failed',
        failure: { code: 'TIMEOUT', message: 'timeout', retryable: true },
        log: { id: 'log-1' },
      })
      .mockResolvedValueOnce({
        status: 'failed',
        failure: { code: 'RATE_LIMIT', message: 'rate', retryable: true },
        log: { id: 'log-2' },
      })
      .mockResolvedValue(successResult);

    await adapter.start('world-1');
    await jest.advanceTimersByTimeAsync(3600000);

    // attempts 1 and 2 retry (backoff 1s and 2s), attempt 3 succeeds; the
    // next tick is then scheduled for the following interval.
    expect(tickRunner.runScheduledTick).toHaveBeenCalledTimes(3);
  });

  it('does not retry a permanent failure and continues the cadence', async () => {
    const { adapter, tickRunner } = createAdapter();
    tickRunner.runScheduledTick.mockResolvedValue({
      status: 'failed',
      failure: {
        code: 'CHARACTER_INACTIVE',
        message: 'inactive',
        retryable: false,
      },
      log: { id: 'log-1' },
    });

    await adapter.start('world-1');
    await jest.advanceTimersByTimeAsync(1800000);
    expect(tickRunner.runScheduledTick).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(1800000);
    expect(tickRunner.runScheduledTick).toHaveBeenCalledTimes(2);
  });

  it('delegates runOneAction to the manual iteration path', async () => {
    const { adapter, tickRunner } = createAdapter();
    tickRunner.runManualIteration.mockResolvedValue(successResult);

    const result = await adapter.runOneAction('mbti-house');

    expect(tickRunner.runManualIteration).toHaveBeenCalledWith({
      worldSlug: 'mbti-house',
      executionSource: 'one-action',
    });
    expect(result).toMatchObject({ status: 'success' });
  });

  it('delegates runCustomAction with character and action overrides', async () => {
    const { adapter, tickRunner } = createAdapter();
    tickRunner.runManualIteration.mockResolvedValue(successResult);

    await adapter.runCustomAction({
      worldSlug: 'mbti-house',
      characterId: 'character-2',
      actionType: 'VOTE',
    });

    expect(tickRunner.runManualIteration).toHaveBeenCalledWith({
      worldSlug: 'mbti-house',
      characterId: 'character-2',
      actionType: 'VOTE',
      executionSource: 'custom',
    });
  });
});
