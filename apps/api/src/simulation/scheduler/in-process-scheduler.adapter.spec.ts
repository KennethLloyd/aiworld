import { PostDecision } from '@/simulation/actions/simulation-decision';
import { WorldSimulationConfigRecord } from '@/simulation/lifecycle/domain/world-simulation-config-record';
import { SimulationWorkRejectedError } from '@/simulation/lifecycle/simulation-lifecycle.error';
import { SimulationLifecycleService } from '@/simulation/lifecycle/simulation-lifecycle.service';
import { SimulationLogRecord } from '@/simulation/logging/simulation-log-record';
import { InProcessSchedulerAdapter } from '@/simulation/scheduler/in-process-scheduler.adapter';
import { SimulationCastingRepository } from '@/simulation/scheduler/simulation-casting-repository.interface';
import { SimulationIterationPicker } from '@/simulation/scheduler/simulation-iteration-picker';
import { SimulationRandomSource } from '@/simulation/scheduler/simulation-random-source';
import type { SimulationRuntimeStateRecord } from '@/simulation/scheduler/simulation-runtime-state-repository.interface';
import { SimulationRuntimeStateRepository } from '@/simulation/scheduler/simulation-runtime-state-repository.interface';
import { SchedulerConfig } from '@/simulation/scheduler/simulation-scheduler-config';
import { SimulationIterationPickError } from '@/simulation/scheduler/simulation-scheduler.error';
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
  residentCount: 16,
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
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
    updatedAt: new Date('2026-08-01T00:00:00.000Z'),
    ...overrides,
  };
}

function logRecord(
  overrides: Partial<SimulationLogRecord> = {},
): SimulationLogRecord {
  return {
    id: 'log-1',
    worldId: 'world-1',
    characterId: 'character-1',
    action: 'POST',
    targetId: null,
    reasoning: null,
    provider: 'mock',
    model: 'fixture-model',
    latencyMs: null,
    jobId: null,
    executionSource: 'scheduled',
    tokensUsed: null,
    costEstimate: null,
    status: 'SUCCESS',
    errorMessage: null,
    executedAt: new Date('2026-08-13T00:00:00.000Z'),
    ...overrides,
  };
}

function createAdapter(config: Partial<SchedulerConfig> = {}) {
  const lifecycleService = {
    getByWorldId: jest.fn().mockResolvedValue(configRecord()),
    assertManualWorkAllowed: jest.fn().mockResolvedValue(configRecord()),
  } as unknown as jest.Mocked<SimulationLifecycleService>;

  const worldRepository = {
    findById: jest.fn().mockResolvedValue(world),
    findBySlug: jest.fn().mockResolvedValue(world),
  } as unknown as jest.Mocked<WorldRepository>;

  const picker = {
    pickCharacter: jest.fn().mockResolvedValue({ characterId: 'character-1' }),
    pickAction: jest.fn().mockReturnValue('POST'),
  } as unknown as jest.Mocked<SimulationIterationPicker>;

  const castingRepository = {
    findActiveActor: jest.fn().mockResolvedValue(true),
  } as unknown as jest.Mocked<SimulationCastingRepository>;

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
  let runtimeState: SimulationRuntimeStateRecord = {
    worldId: 'world-1',
    pending: false,
    workExpected: false,
    nextTickAt: null,
    lastTickStartedAt: null,
    lastTickCompletedAt: null,
    retrying: false,
    recentRetryCount: 0,
    lastRetryAt: null,
    deadLetterCount: 0,
    lastDeadLetterAt: null,
    lastDeadLetterReason: null,
    bootResumeFailure: null,
  };
  const runtimeStateRepository = {
    findByWorldId: jest.fn().mockImplementation(async () => runtimeState),
    update: jest.fn().mockImplementation(async (_worldId, input) => {
      runtimeState = { ...runtimeState, ...input };
    }),
    recordRetry: jest.fn().mockImplementation(async () => {
      runtimeState = {
        ...runtimeState,
        retrying: true,
        recentRetryCount: runtimeState.recentRetryCount + 1,
        lastRetryAt: new Date(),
      };
    }),
    recordDeadLetter: jest.fn(),
  } as unknown as jest.Mocked<SimulationRuntimeStateRepository>;

  const adapter = new InProcessSchedulerAdapter(
    lifecycleService,
    worldRepository,
    picker,
    castingRepository,
    tickRunner,
    randomSource,
    schedulerConfig,
    runtimeStateRepository,
  );

  return {
    adapter,
    lifecycleService,
    worldRepository,
    picker,
    castingRepository,
    tickRunner,
    randomSource,
  };
}

const postDecision: PostDecision = {
  action: 'POST',
  worldId: 'world-1',
  memberId: 'member-1',
  characterId: 'character-1',
  title: 'A new post',
  content: 'Body.',
  reasoning: 'Reasoning.',
};

const successResult = {
  status: 'success' as const,
  decision: postDecision,
  log: logRecord(),
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
    expect(tickRunner.runScheduledTick).toHaveBeenCalledWith(
      expect.objectContaining({
        worldSlug: 'mbti-house',
        characterId: 'character-1',
        actionType: 'POST',
        executionSource: 'scheduled',
      }),
    );

    await jest.advanceTimersByTimeAsync(1800000);
    expect(tickRunner.runScheduledTick).toHaveBeenCalledTimes(2);
  });

  it('exposes pending and completed tick timestamps', async () => {
    const { adapter, tickRunner } = createAdapter();
    tickRunner.runScheduledTick.mockResolvedValue(successResult);

    await adapter.start('world-1');
    const pending = await adapter.getObservability('world-1');
    expect(pending).toMatchObject({
      available: true,
      pending: true,
      workExpected: true,
      lastTickStartedAt: null,
      lastTickCompletedAt: null,
      retrying: false,
    });
    expect(pending.nextTickAt).toBeInstanceOf(Date);

    await jest.advanceTimersByTimeAsync(1_800_000);
    const completed = await adapter.getObservability('world-1');
    expect(completed.lastTickStartedAt).toBeInstanceOf(Date);
    expect(completed.lastTickCompletedAt).toBeInstanceOf(Date);
    expect(completed.pending).toBe(true);
  });

  it('never runs two ticks at once (next handle starts after completion)', async () => {
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

  it('does not schedule inactive Worlds even when RUNNING is persisted', async () => {
    const { adapter, worldRepository, randomSource, tickRunner } =
      createAdapter();
    worldRepository.findById.mockResolvedValue({
      ...world,
      isActive: false,
    });

    await adapter.start('world-1');
    await jest.advanceTimersByTimeAsync(3600000);

    expect(randomSource.next).not.toHaveBeenCalled();
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
        log: logRecord({ status: 'FAILED' }),
      })
      .mockResolvedValueOnce({
        status: 'failed',
        failure: { code: 'RATE_LIMIT', message: 'rate', retryable: true },
        log: logRecord({ status: 'FAILED' }),
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
      log: logRecord({ status: 'FAILED' }),
    });

    await adapter.start('world-1');
    await jest.advanceTimersByTimeAsync(1800000);
    expect(tickRunner.runScheduledTick).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(1800000);
    expect(tickRunner.runScheduledTick).toHaveBeenCalledTimes(2);
  });

  it('stops the cadence without rerunning when no characters can act', async () => {
    const { adapter, picker, tickRunner } = createAdapter();
    picker.pickCharacter.mockRejectedValue(
      new SimulationIterationPickError(
        'NO_ACTIVE_CHARACTERS',
        'World "world-1" has no active AI characters to act',
      ),
    );

    await adapter.start('world-1');
    await jest.advanceTimersByTimeAsync(3600000);

    expect(tickRunner.runScheduledTick).not.toHaveBeenCalled();
  });

  it('composes runOneAction into a scheduled-style command and runs it manually', async () => {
    const { adapter, tickRunner } = createAdapter();
    tickRunner.runManualIteration.mockResolvedValue(successResult);

    const result = await adapter.runOneAction('mbti-house');

    expect(tickRunner.runManualIteration).toHaveBeenCalledWith(
      expect.objectContaining({
        worldSlug: 'mbti-house',
        characterId: 'character-1',
        actionType: 'POST',
        executionSource: 'one-action',
      }),
    );
    expect(result).toMatchObject({ status: 'success' });
  });

  it('composes runCustomAction with character and action overrides', async () => {
    const { adapter, tickRunner } = createAdapter();
    tickRunner.runManualIteration.mockResolvedValue(successResult);

    await adapter.runCustomAction({
      worldSlug: 'mbti-house',
      characterId: 'character-2',
      actionType: 'VOTE',
    });

    expect(tickRunner.runManualIteration).toHaveBeenCalledWith(
      expect.objectContaining({
        worldSlug: 'mbti-house',
        characterId: 'character-2',
        actionType: 'VOTE',
        executionSource: 'custom',
      }),
    );
  });

  it('rejects a custom action naming a character outside the world before composing', async () => {
    const { adapter, castingRepository, tickRunner } = createAdapter();
    castingRepository.findActiveActor.mockResolvedValue(false);

    await expect(
      adapter.runCustomAction({
        worldSlug: 'mbti-house',
        characterId: 'foreign-character',
        actionType: 'POST',
      }),
    ).rejects.toThrow('not an active member of World');

    expect(castingRepository.findActiveActor).toHaveBeenCalledWith(
      'world-1',
      'foreign-character',
    );
    expect(tickRunner.runManualIteration).not.toHaveBeenCalled();
  });

  it('rejects manual work at the service gate before composing when HALTED', async () => {
    const { adapter, lifecycleService, picker } = createAdapter();
    lifecycleService.assertManualWorkAllowed.mockRejectedValue(
      new SimulationWorkRejectedError('MANUAL', 'HALTED'),
    );

    await expect(adapter.runOneAction('mbti-house')).rejects.toThrow(
      'rejected in state HALTED',
    );
    expect(picker.pickCharacter).not.toHaveBeenCalled();
  });

  it('rejects manual work at the service gate when the World is inactive', async () => {
    const { adapter, lifecycleService, picker } = createAdapter();
    lifecycleService.assertManualWorkAllowed.mockRejectedValue(
      new SimulationWorkRejectedError('MANUAL', 'PAUSED', 'INACTIVE'),
    );

    await expect(adapter.runOneAction('mbti-house')).rejects.toThrow(
      'World is inactive',
    );
    expect(picker.pickCharacter).not.toHaveBeenCalled();
  });
});
