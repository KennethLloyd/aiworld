import { UnrecoverableError } from 'bullmq';

import { PostDecision } from '@/simulation/actions/simulation-decision';
import { WorldSimulationConfigRecord } from '@/simulation/lifecycle/domain/world-simulation-config-record';
import { SimulationLifecycleService } from '@/simulation/lifecycle/simulation-lifecycle.service';
import { SimulationLogRecord } from '@/simulation/logging/simulation-log-record';
import { BullMqSchedulerAdapter } from '@/simulation/scheduler/bullmq-scheduler.adapter';
import { SimulationCastingRepository } from '@/simulation/scheduler/simulation-casting-repository.interface';
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
    data: {
      worldSlug: 'mbti-house',
      characterId: 'character-1',
      actionType: 'POST',
      executionSource: 'scheduled',
      issuedAt: '2026-08-13T00:00:00.000Z',
    },
    remove: jest.fn().mockResolvedValue(undefined),
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
    adapterId: 'bullmq',
    redisUrl: 'redis://localhost:6379',
    maxAttempts: 3,
    retryBaseDelayMs: 1000,
    ...config,
  };

  const queue = {
    add: jest.fn().mockResolvedValue(undefined),
    getJobs: jest.fn().mockResolvedValue([]),
    remove: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
  };
  const dlq = {
    add: jest.fn().mockResolvedValue(undefined),
    getJobs: jest.fn().mockResolvedValue([]),
    close: jest.fn().mockResolvedValue(undefined),
  };
  const connection = {
    quit: jest.fn().mockResolvedValue(undefined),
  };

  const adapter = new BullMqSchedulerAdapter(
    schedulerConfig,
    lifecycleService,
    worldRepository,
    picker,
    castingRepository,
    randomSource,
    tickRunner,
    queue as never,
    dlq as never,
    connection as never,
  );
  const worker = {
    on: jest.fn(),
    isRunning: jest.fn().mockReturnValue(true),
    close: jest.fn().mockResolvedValue(undefined),
  };
  adapter.attachWorker(worker as never);

  return {
    adapter,
    lifecycleService,
    worldRepository,
    picker,
    castingRepository,
    tickRunner,
    queue,
    dlq,
    worker,
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

describe('BullMqSchedulerAdapter', () => {
  it('start removes the pending tick and enqueues a delayed self-rescheduling job', async () => {
    const { adapter, queue } = createAdapter();
    const stale = fakeJob({ id: 'stale' });
    const otherWorld = fakeJob({ name: 'tick:other-world', id: 'other' });
    queue.getJobs.mockResolvedValue([stale, otherWorld]);

    await adapter.start('world-1');

    expect(queue.getJobs).toHaveBeenCalledWith(['delayed', 'waiting']);
    expect(stale.remove).toHaveBeenCalled();
    expect(otherWorld.remove).not.toHaveBeenCalled();

    expect(queue.add).toHaveBeenCalledTimes(1);
    const [name, command, options] = queue.add.mock.calls[0];
    expect(name).toBe('tick_world-1');
    expect(command).toMatchObject({
      worldSlug: 'mbti-house',
      characterId: 'character-1',
      actionType: 'POST',
      executionSource: 'scheduled',
    });
    expect(options).toMatchObject({
      delay: 1800000,
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: true,
      removeOnFail: false,
    });
  });
  it('exposes pending scheduler progress and aggregate dead-letter signals', async () => {
    const { adapter, dlq } = createAdapter();

    await adapter.start('world-1');
    let observability = await adapter.getObservability('world-1');

    expect(observability).toMatchObject({
      available: true,
      pending: true,
      recentRetryCount: 0,
      deadLetterCount: 0,
    });
    expect(observability.nextTickAt).toBeInstanceOf(Date);

    dlq.getJobs.mockResolvedValue([
      {
        data: {
          command: { worldSlug: 'mbti-house' },
          reason: 'TIMEOUT',
          failedAt: '2026-08-13T00:20:00.000Z',
        },
      },
      {
        data: {
          command: { worldSlug: 'other-world' },
          reason: 'ignored',
          failedAt: '2026-08-13T00:21:00.000Z',
        },
      },
    ]);
    observability = await adapter.getObservability('world-1');

    expect(observability.deadLetterCount).toBe(1);
    expect(observability.lastDeadLetterReason).toBe('TIMEOUT');
  });

  it('start is a no-op for a world that is not RUNNING', async () => {
    const { adapter, lifecycleService, queue } = createAdapter();
    lifecycleService.getByWorldId.mockResolvedValue(
      configRecord({ state: 'PAUSED' }),
    );

    await adapter.start('world-1');

    expect(queue.add).not.toHaveBeenCalled();
  });

  it('start is a no-op for an inactive World even when RUNNING is persisted', async () => {
    const { adapter, worldRepository, queue } = createAdapter();
    worldRepository.findById.mockResolvedValue({
      ...world,
      isActive: false,
    });

    await adapter.start('world-1');

    expect(queue.add).not.toHaveBeenCalled();
  });

  it('stop removes the tracked pending tick without scanning the queue', async () => {
    const { adapter, queue } = createAdapter();

    await adapter.start('world-1');
    expect(queue.add).toHaveBeenCalledTimes(1);
    queue.getJobs.mockClear();

    await adapter.stop('world-1');

    expect(queue.remove).toHaveBeenCalledWith(expect.any(String));
    expect(queue.getJobs).not.toHaveBeenCalled();
  });

  it('stop is a no-op when nothing is pending for the world', async () => {
    const { adapter, queue } = createAdapter();

    await adapter.stop('world-1');

    expect(queue.remove).not.toHaveBeenCalled();
  });

  describe('process', () => {
    it('completes on success and schedules the next tick', async () => {
      const { adapter, tickRunner, queue } = createAdapter();
      tickRunner.runScheduledTick.mockResolvedValue(successResult);

      await expect(
        adapter.process(fakeJob() as never),
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
    });

    it('treats a lifecycle rejection as a completed job and reschedules', async () => {
      const { adapter, tickRunner, queue } = createAdapter();
      tickRunner.runScheduledTick.mockResolvedValue({
        status: 'rejected',
        reason: 'rejected',
        log: logRecord({ status: 'REJECTED' }),
      });

      await expect(
        adapter.process(fakeJob() as never),
      ).resolves.toBeUndefined();

      expect(queue.add).toHaveBeenCalledTimes(1);
    });

    it('throws a retryable error on a transient failure so BullMQ retries', async () => {
      const { adapter, tickRunner, queue } = createAdapter();
      tickRunner.runScheduledTick.mockResolvedValue({
        status: 'failed',
        failure: { code: 'TIMEOUT', message: 'timeout', retryable: true },
        log: logRecord({ status: 'FAILED' }),
      });

      await expect(adapter.process(fakeJob() as never)).rejects.toThrow(
        'TIMEOUT: timeout',
      );
      expect(queue.add).not.toHaveBeenCalled();
    });

    it('throws UnrecoverableError on a permanent failure (no retry)', async () => {
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

      await expect(adapter.process(fakeJob() as never)).rejects.toBeInstanceOf(
        UnrecoverableError,
      );
    });

    it('dead-letters malformed commands without running them', async () => {
      const { adapter, tickRunner } = createAdapter();

      await expect(
        adapter.process(fakeJob({ data: { actionType: 'DELETE' } }) as never),
      ).rejects.toBeInstanceOf(UnrecoverableError);
      expect(tickRunner.runScheduledTick).not.toHaveBeenCalled();
    });

    it('dead-letters an unresolvable world surfaced by the runner', async () => {
      const { adapter, tickRunner } = createAdapter();
      tickRunner.runScheduledTick.mockRejectedValue(
        new Error('World "mbti-house" was not found'),
      );

      await expect(adapter.process(fakeJob() as never)).rejects.toBeInstanceOf(
        UnrecoverableError,
      );
    });

    it('never retries a completed tick whose next-tick scheduling failed', async () => {
      const { adapter, tickRunner, queue } = createAdapter();
      tickRunner.runScheduledTick.mockResolvedValue(successResult);
      queue.add.mockRejectedValue(new Error('Redis unreachable'));

      await expect(adapter.process(fakeJob() as never)).rejects.toBeInstanceOf(
        UnrecoverableError,
      );
      expect(tickRunner.runScheduledTick).toHaveBeenCalledTimes(1);
    });
  });

  it('dead-letters a finally-failed job to the DLQ queue', async () => {
    const { worker, dlq } = createAdapter();
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
    const { worker, dlq } = createAdapter();
    const handler = worker.on.mock.calls.find(
      ([event]) => event === 'failed',
    )?.[1];

    await (handler as (job: unknown, error: Error) => void)(
      fakeJob({ attemptsMade: 1, opts: { attempts: 3 } }),
      new Error('temporary timeout'),
    );

    expect(dlq.add).not.toHaveBeenCalled();
  });

  it('composes runOneAction into a scheduled-style command and runs it manually', async () => {
    const { adapter, tickRunner } = createAdapter();
    tickRunner.runManualIteration.mockResolvedValue(successResult);

    await adapter.runOneAction('mbti-house');

    expect(tickRunner.runManualIteration).toHaveBeenCalledWith(
      expect.objectContaining({
        worldSlug: 'mbti-house',
        characterId: 'character-1',
        actionType: 'POST',
        executionSource: 'one-action',
      }),
    );
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
});
