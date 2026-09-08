import { UnrecoverableError } from 'bullmq';

import { PostDecision } from '@/simulation/actions/simulation-decision';
import { WorldSimulationConfigRecord } from '@/simulation/lifecycle/domain/world-simulation-config-record';
import { SimulationLifecycleService } from '@/simulation/lifecycle/simulation-lifecycle.service';
import { SimulationLogRecord } from '@/simulation/logging/simulation-log-record';
import { SimulationCastingRepository } from '@/simulation/scheduler/simulation-casting-repository.interface';
import { SimulationIterationPicker } from '@/simulation/scheduler/simulation-iteration-picker';
import { SimulationRandomSource } from '@/simulation/scheduler/simulation-random-source';
import { SimulationRunner } from '@/simulation/scheduler/simulation-runner';
import type { SimulationRuntimeStateRecord } from '@/simulation/scheduler/simulation-runtime-state-repository.interface';
import { SimulationRuntimeStateRepository } from '@/simulation/scheduler/simulation-runtime-state-repository.interface';
import { SimulationScheduler } from '@/simulation/scheduler/simulation-scheduler';
import { SchedulerConfig } from '@/simulation/scheduler/simulation-scheduler-config';
import { SimulationIterationPickError } from '@/simulation/scheduler/simulation-scheduler.error';
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

function fakeJob(overrides: Record<string, unknown> = {}) {
  return {
    id: 'job-1',
    name: 'tick_world-1',
    timestamp: Date.now(),
    delay: 1800000,
    data: {
      worldSlug: 'mbti-house',
      characterId: 'character-1',
      actionType: 'POST',
      executionSource: 'scheduled',
      issuedAt: '2026-08-13T00:00:00.000Z',
    },
    getState: jest.fn().mockResolvedValue('delayed'),
    remove: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function createScheduler(config: Partial<SchedulerConfig> = {}) {
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
    pickAutomaticAction: jest.fn().mockResolvedValue('POST'),
  } as unknown as jest.Mocked<SimulationIterationPicker>;

  const castingRepository = {
    findActiveActors: jest.fn().mockResolvedValue([
      {
        memberId: 'member-1',
        characterId: 'character-1',
        lastActivityAt: null,
      },
    ]),
    findActiveActor: jest.fn().mockResolvedValue(true),
  } as unknown as jest.Mocked<SimulationCastingRepository>;

  const tickRunner = {
    runScheduledTick: jest.fn(),
    runOneAction: jest.fn(),
    runCustomAction: jest.fn(),
  } as unknown as jest.Mocked<SimulationRunner>;

  const randomSource = {
    next: jest.fn().mockReturnValue(0.5),
  } as unknown as jest.Mocked<SimulationRandomSource>;

  const schedulerConfig: SchedulerConfig = {
    redisUrl: 'redis://localhost:6379',
    maxAttempts: 3,
    retryBaseDelayMs: 1000,
    ...config,
  };

  const queue = {
    add: jest.fn().mockResolvedValue(fakeJob()),
    getDeduplicationJobId: jest.fn().mockResolvedValue(null),
    getJob: jest.fn().mockResolvedValue(undefined),
    removeDeduplicationKey: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
  };
  const dlq = {
    add: jest.fn().mockResolvedValue(undefined),
    getJobs: jest.fn().mockResolvedValue([]),
    close: jest.fn().mockResolvedValue(undefined),
  };
  const connection = {
    quit: jest.fn().mockResolvedValue(undefined),
    status: 'ready',
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
    blockedReason: null,
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
    recordDeadLetter: jest
      .fn()
      .mockImplementation(async (_worldId, occurredAt, reason) => {
        runtimeState = {
          ...runtimeState,
          deadLetterCount: runtimeState.deadLetterCount + 1,
          lastDeadLetterAt: occurredAt,
          lastDeadLetterReason: reason,
        };
      }),
  } as unknown as jest.Mocked<SimulationRuntimeStateRepository>;

  const scheduler = new SimulationScheduler(
    schedulerConfig,
    lifecycleService,
    worldRepository,
    picker,
    castingRepository,
    randomSource,
    tickRunner,
    runtimeStateRepository,
    queue as never,
    dlq as never,
    connection as never,
  );
  const worker = {
    on: jest.fn(),
    isRunning: jest.fn().mockReturnValue(true),
    close: jest.fn().mockResolvedValue(undefined),
  };
  scheduler.attachWorker(worker as never);

  return {
    scheduler,
    lifecycleService,
    worldRepository,
    picker,
    castingRepository,
    tickRunner,
    queue,
    connection,
    dlq,
    worker,
    runtimeStateRepository,
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

describe('SimulationScheduler', () => {
  it('start retains an existing Tick instead of creating a duplicate', async () => {
    const { scheduler, queue } = createScheduler();
    const stale = fakeJob({ id: 'stale' });
    queue.getDeduplicationJobId.mockResolvedValue('stale');
    queue.getJob.mockResolvedValue(stale);

    await scheduler.start('world-1');

    expect(queue.getDeduplicationJobId).toHaveBeenCalledWith('world-1');
    expect(queue.getJob).toHaveBeenCalledWith('stale');
    expect(stale.remove).not.toHaveBeenCalled();

    expect(queue.add).not.toHaveBeenCalled();
  });

  it('ensureScheduled does not create a second pending Tick', async () => {
    const { scheduler, queue, worldRepository } = createScheduler();
    const existing = fakeJob({ id: 'existing-tick' });
    queue.getDeduplicationJobId.mockResolvedValue('existing-tick');
    queue.getJob.mockResolvedValue(existing);

    await scheduler.ensureScheduled('world-1');

    expect(worldRepository.findById).toHaveBeenCalledWith('world-1');
    expect(queue.add).not.toHaveBeenCalled();
    expect(existing.remove).not.toHaveBeenCalled();
  });

  it('records a blocked reason when no active AI Resident can act', async () => {
    const { scheduler, picker, queue } = createScheduler();
    picker.pickCharacter.mockRejectedValue(
      new SimulationIterationPickError(
        'NO_ACTIVE_CHARACTERS',
        'World "world-1" has no active AI characters to act',
      ),
    );

    await scheduler.ensureScheduled('world-1');

    expect(queue.add).not.toHaveBeenCalled();
    await expect(scheduler.getObservability('world-1')).resolves.toMatchObject({
      pending: false,
      workExpected: false,
      blockedReason: 'NO_ACTIVE_RESIDENTS',
    });
  });

  it('removes a pending Tick when all active AI Residents become unavailable', async () => {
    const { scheduler, castingRepository, queue } = createScheduler();
    const existing = fakeJob({ id: 'existing-tick' });
    queue.getDeduplicationJobId.mockResolvedValue('existing-tick');
    queue.getJob.mockResolvedValue(existing);
    castingRepository.findActiveActors.mockResolvedValue([]);

    await scheduler.ensureScheduled('world-1');

    expect(existing.remove).toHaveBeenCalledTimes(1);
    expect(queue.add).not.toHaveBeenCalled();
    await expect(scheduler.getObservability('world-1')).resolves.toMatchObject({
      pending: false,
      workExpected: false,
      blockedReason: 'NO_ACTIVE_RESIDENTS',
    });
  });
  it('exposes pending scheduler progress and persisted dead-letter signals', async () => {
    const { scheduler, worker, dlq } = createScheduler();

    await scheduler.start('world-1');
    let observability = await scheduler.getObservability('world-1');

    expect(observability).toMatchObject({
      available: true,
      pending: true,
      workExpected: true,
      recentRetryCount: 0,
      deadLetterCount: 0,
    });
    expect(observability.nextTickAt).toBeInstanceOf(Date);

    const handler = worker.on.mock.calls.find(
      ([event]) => event === 'failed',
    )?.[1];
    expect(handler).toBeDefined();
    await (handler as (job: unknown, error: Error) => Promise<void>)(
      fakeJob({ id: 'dead-job' }),
      new Error('TIMEOUT'),
    );

    observability = await scheduler.getObservability('world-1');
    expect(observability).toMatchObject({
      pending: false,
      workExpected: false,
      nextTickAt: null,
      deadLetterCount: 1,
      lastDeadLetterReason: 'TIMEOUT',
    });
    expect(dlq.add).toHaveBeenCalledWith(
      'tick_world-1',
      expect.objectContaining({ reason: 'TIMEOUT' }),
      expect.anything(),
    );
    expect(dlq.getJobs).not.toHaveBeenCalled();
  });
  it('reports the scheduler unavailable while Redis is not ready', async () => {
    const { scheduler, connection } = createScheduler();

    connection.status = 'reconnecting';

    await expect(scheduler.getObservability('world-1')).resolves.toMatchObject({
      available: false,
    });
  });

  it('start is a no-op for a world that is not RUNNING', async () => {
    const { scheduler, lifecycleService, queue } = createScheduler();
    lifecycleService.getByWorldId.mockResolvedValue(
      configRecord({ state: 'PAUSED' }),
    );

    await scheduler.start('world-1');

    expect(queue.add).not.toHaveBeenCalled();
  });

  it('start is a no-op for an inactive World even when RUNNING is persisted', async () => {
    const { scheduler, worldRepository, queue } = createScheduler();
    worldRepository.findById.mockResolvedValue({
      ...world,
      isActive: false,
    });

    await scheduler.start('world-1');

    expect(queue.add).not.toHaveBeenCalled();
  });

  it('stop removes the pending native-deduplicated tick', async () => {
    const { scheduler, queue } = createScheduler();

    await scheduler.start('world-1');
    expect(queue.add).toHaveBeenCalledTimes(1);
    const pending = fakeJob({ id: 'job-1' });
    queue.getDeduplicationJobId.mockResolvedValue('job-1');
    queue.getJob.mockResolvedValue(pending);
    await scheduler.stop('world-1');

    expect(queue.getDeduplicationJobId).toHaveBeenCalledWith('world-1');
    expect(queue.getJob).toHaveBeenCalledWith('job-1');
    expect(pending.remove).toHaveBeenCalledTimes(1);
  });

  it('stop is a no-op when nothing is pending for the world', async () => {
    const { scheduler, queue } = createScheduler();

    await scheduler.stop('world-1');

    expect(queue.getDeduplicationJobId).toHaveBeenCalledWith('world-1');
  });

  describe('process', () => {
    it('completes on success and schedules the next tick', async () => {
      const { scheduler, tickRunner, queue } = createScheduler();
      tickRunner.runScheduledTick.mockResolvedValue(successResult);

      await expect(
        scheduler.process(fakeJob() as never),
      ).resolves.toBeUndefined();

      expect(tickRunner.runScheduledTick).toHaveBeenCalledWith(
        {
          worldSlug: 'mbti-house',
          characterId: 'character-1',
          actionType: 'POST',
          executionSource: 'scheduled',
          issuedAt: '2026-08-13T00:00:00.000Z',
        },
        'job-1',
      );
      expect(queue.add).toHaveBeenCalledTimes(1);
      expect(queue.add.mock.calls[0][0]).toBe('tick_world-1');
      expect(queue.add.mock.calls[0][2]).toEqual(
        expect.objectContaining({
          deduplication: { id: 'world-1', keepLastIfActive: true },
        }),
      );
    });

    it('keeps native deduplication active while an existing tick is running', async () => {
      const { scheduler, tickRunner, queue } = createScheduler();
      tickRunner.runScheduledTick.mockResolvedValue(successResult);
      queue.add.mockResolvedValue(fakeJob({ id: 'active-job' }));

      await scheduler.process(fakeJob({ id: 'active-job' }) as never);

      expect(queue.add).toHaveBeenCalledWith(
        'tick_world-1',
        expect.any(Object),
        expect.objectContaining({
          deduplication: { id: 'world-1', keepLastIfActive: true },
        }),
      );
    });

    it('treats a lifecycle rejection as a completed job and reschedules', async () => {
      const { scheduler, tickRunner, queue } = createScheduler();
      tickRunner.runScheduledTick.mockResolvedValue({
        status: 'rejected',
        reason: 'rejected',
        log: logRecord({ status: 'REJECTED' }),
      });

      await expect(
        scheduler.process(fakeJob() as never),
      ).resolves.toBeUndefined();

      expect(queue.add).toHaveBeenCalledTimes(1);
    });

    it('throws a retryable error on a transient failure so BullMQ retries', async () => {
      const { scheduler, tickRunner, queue } = createScheduler();
      tickRunner.runScheduledTick.mockResolvedValue({
        status: 'failed',
        failure: { code: 'TIMEOUT', message: 'timeout', retryable: true },
        log: logRecord({ status: 'FAILED' }),
      });

      await expect(scheduler.process(fakeJob() as never)).rejects.toThrow(
        'TIMEOUT: timeout',
      );
      expect(queue.add).not.toHaveBeenCalled();
    });

    it('resolves a permanent Action failure and schedules a fresh tick', async () => {
      const { scheduler, tickRunner, queue, dlq } = createScheduler();
      tickRunner.runScheduledTick.mockResolvedValue({
        status: 'failed',
        failure: {
          code: 'CHARACTER_INACTIVE',
          message: 'inactive',
          retryable: false,
        },
        log: logRecord({ status: 'FAILED' }),
      });

      await expect(
        scheduler.process(fakeJob() as never),
      ).resolves.toBeUndefined();
      expect(queue.add).toHaveBeenCalledTimes(1);
      expect(dlq.add).not.toHaveBeenCalled();
    });

    it('resolves an exhausted transient Action failure and schedules a fresh tick', async () => {
      const { scheduler, tickRunner, queue, dlq } = createScheduler();
      tickRunner.runScheduledTick.mockResolvedValue({
        status: 'failed',
        failure: { code: 'TIMEOUT', message: 'timeout', retryable: true },
        log: logRecord({ status: 'FAILED' }),
      });

      await expect(
        scheduler.process(
          fakeJob({ attemptsMade: 2, opts: { attempts: 3 } }) as never,
        ),
      ).resolves.toBeUndefined();
      expect(queue.add).toHaveBeenCalledTimes(1);
      expect(dlq.add).not.toHaveBeenCalled();
    });

    it('keeps a fresh-tick scheduling error on the scheduler fault path', async () => {
      const { scheduler, tickRunner, queue } = createScheduler();
      tickRunner.runScheduledTick.mockResolvedValue({
        status: 'failed',
        failure: {
          code: 'CHARACTER_INACTIVE',
          message: 'inactive',
          retryable: false,
        },
        log: logRecord({ status: 'FAILED' }),
      });
      queue.add.mockRejectedValue(new Error('Redis unavailable'));

      await expect(
        scheduler.process(fakeJob() as never),
      ).rejects.toBeInstanceOf(UnrecoverableError);
    });

    it('dead-letters malformed commands without running them', async () => {
      const { scheduler, tickRunner } = createScheduler();

      await expect(
        scheduler.process(fakeJob({ data: { actionType: 'DELETE' } }) as never),
      ).rejects.toBeInstanceOf(UnrecoverableError);
      expect(tickRunner.runScheduledTick).not.toHaveBeenCalled();
    });

    it('dead-letters an unresolvable world surfaced by the runner', async () => {
      const { scheduler, tickRunner } = createScheduler();
      tickRunner.runScheduledTick.mockRejectedValue(
        new Error('World "mbti-house" was not found'),
      );

      await expect(
        scheduler.process(fakeJob() as never),
      ).rejects.toBeInstanceOf(UnrecoverableError);
    });

    it('never retries a completed tick whose next-tick scheduling failed', async () => {
      const { scheduler, tickRunner, queue } = createScheduler();
      tickRunner.runScheduledTick.mockResolvedValue(successResult);
      queue.add.mockRejectedValue(new Error('Redis unreachable'));

      await expect(
        scheduler.process(fakeJob() as never),
      ).rejects.toBeInstanceOf(UnrecoverableError);
      expect(tickRunner.runScheduledTick).toHaveBeenCalledTimes(1);
    });
  });

  it('dead-letters a finally-failed job to the DLQ queue', async () => {
    const { worker, dlq } = createScheduler();
    const handler = worker.on.mock.calls.find(
      ([event]) => event === 'failed',
    )?.[1];

    expect(handler).toBeDefined();

    const job = fakeJob({ id: 'job-7' });
    await (handler as (job: unknown, error: Error) => void)(
      job,
      new Error('authorization: Bearer secret https://provider.test/body'),
    );

    expect(dlq.add).toHaveBeenCalledWith(
      'tick_world-1',
      expect.objectContaining({
        command: expect.any(Object),
        jobId: 'job-7',
        reason: 'authorization: Bearer [REDACTED] [URL_REDACTED]',
      }),
      expect.anything(),
    );
  });

  it('does not count an intermediate retry as a dead-lettered job', async () => {
    const { worker, dlq } = createScheduler();
    const handler = worker.on.mock.calls.find(
      ([event]) => event === 'failed',
    )?.[1];

    await (handler as (job: unknown, error: Error) => void)(
      fakeJob({ attemptsMade: 1, opts: { attempts: 3 } }),
      new Error('temporary timeout'),
    );

    expect(dlq.add).not.toHaveBeenCalled();
  });

  it('delegates Run One Action to the shared SimulationRunner', async () => {
    const { scheduler, tickRunner } = createScheduler();
    tickRunner.runOneAction.mockResolvedValue(successResult);

    await scheduler.runOneAction('mbti-house');

    expect(tickRunner.runOneAction).toHaveBeenCalledWith('mbti-house');
  });

  it('delegates Custom Action to the shared SimulationRunner', async () => {
    const { scheduler, tickRunner } = createScheduler();
    tickRunner.runCustomAction.mockResolvedValue(successResult);

    const input = {
      worldSlug: 'mbti-house',
      characterId: 'character-2',
      actionType: 'VOTE',
    } as const;
    await scheduler.runCustomAction(input);

    expect(tickRunner.runCustomAction).toHaveBeenCalledWith(input);
  });
});
