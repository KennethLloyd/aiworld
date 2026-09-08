import { randomUUID } from 'node:crypto';

import {
  deriveScheduledDelayMs,
  simulationCommandSchema,
} from '@aiworld/shared/schemas/simulation-command.schema';
import type { SimulationCommand } from '@aiworld/shared/schemas/simulation-command.schema';
import {
  Inject,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Job, Queue, UnrecoverableError, Worker } from 'bullmq';
import { Redis as IORedis } from 'ioredis';

import { redactDiagnostics } from '@/common/diagnostics';
import type { SimulationActionType } from '@/simulation/actions/simulation-action-type';
import { SimulationActionError } from '@/simulation/actions/simulation-action.error';
import type { WorldSimulationConfigRecord } from '@/simulation/lifecycle/domain/world-simulation-config-record';
import { SimulationLifecycleService } from '@/simulation/lifecycle/simulation-lifecycle.service';
import { SimulationCastingRepository } from '@/simulation/scheduler/simulation-casting-repository.interface';
import { SimulationIterationPicker } from '@/simulation/scheduler/simulation-iteration-picker';
import { SimulationRandomSource } from '@/simulation/scheduler/simulation-random-source';
import { SimulationRunner } from '@/simulation/scheduler/simulation-runner';
import type { IterationRunResult } from '@/simulation/scheduler/simulation-runner';
import { RECENT_RETRY_WINDOW_MS } from '@/simulation/scheduler/simulation-runtime-signals';
import type { SimulationRuntimeSignals } from '@/simulation/scheduler/simulation-runtime-signals';
import { SimulationRuntimeStateRepository } from '@/simulation/scheduler/simulation-runtime-state-repository.interface';
import type { SimulationRuntimeStateRecord } from '@/simulation/scheduler/simulation-runtime-state-repository.interface';
import {
  SCHEDULER_CONFIG,
  type SchedulerConfig,
} from '@/simulation/scheduler/simulation-scheduler-config';
import {
  isTransientSchedulerError,
  SimulationIterationPickError,
} from '@/simulation/scheduler/simulation-scheduler.error';
import type { WorldRecord } from '@/world/domain/world-record';
import { WorldRepository } from '@/world/repositories/world-repository.interface';

export const SIMULATION_TICKS_QUEUE = 'simulation-ticks';
export const SIMULATION_TICKS_DLQ = 'simulation-ticks-dlq';
export const SIMULATION_REDIS = Symbol('SIMULATION_REDIS');
export const SIMULATION_QUEUE = Symbol('SIMULATION_QUEUE');
export const SIMULATION_DLQ = Symbol('SIMULATION_DLQ');

function emptyRuntimeState(worldId: string): SimulationRuntimeStateRecord {
  return {
    worldId,
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
}

export type RunCustomActionInput = {
  worldSlug: string;
  characterId?: string;
  actionType?: SimulationActionType;
};

export type SimulationSchedulerObservabilityRecord =
  SimulationRuntimeSignals & {
    available: boolean;
  };

function tickJobName(worldId: string): string {
  return `tick_${worldId}`;
}

function tickJobId(worldId: string): string {
  return `${tickJobName(worldId)}_${randomUUID()}`;
}

function safeSchedulerError(error: unknown, fallback: string): Error {
  const safeError = new Error(
    redactDiagnostics(error instanceof Error ? error.message : fallback),
  );
  safeError.name = error instanceof Error ? error.name : 'SchedulerError';
  return safeError;
}

@Injectable()
export class SimulationScheduler implements OnModuleInit, OnModuleDestroy {
  private worker: Worker | null = null;

  constructor(
    @Inject(SCHEDULER_CONFIG)
    private readonly schedulerConfig: SchedulerConfig,
    private readonly lifecycleService: SimulationLifecycleService,
    private readonly worldRepository: WorldRepository,
    private readonly picker: SimulationIterationPicker,
    private readonly castingRepository: SimulationCastingRepository,
    private readonly randomSource: SimulationRandomSource,
    private readonly runner: SimulationRunner,
    private readonly runtimeStateRepository: SimulationRuntimeStateRepository,
    @Inject(SIMULATION_QUEUE)
    private readonly queue: Queue,
    @Inject(SIMULATION_DLQ)
    private readonly dlq: Queue,
    @Inject(SIMULATION_REDIS)
    private readonly connection: IORedis,
  ) {}

  onModuleInit(): void {
    this.attachWorker(
      new Worker(SIMULATION_TICKS_QUEUE, (job) => this.process(job), {
        connection: this.connection,
        concurrency: 1,
      }),
    );
  }

  attachWorker(worker: Worker): void {
    this.worker = worker;
    worker.on('failed', (job, error) => {
      if (
        job &&
        (error instanceof UnrecoverableError ||
          job.attemptsMade === undefined ||
          job.attemptsMade >= (job.opts.attempts ?? 1))
      ) {
        return this.handleFinalFailure(job, error).catch(() => undefined);
      }
    });
  }
  async start(worldId: string): Promise<void> {
    await this.ensureScheduled(worldId);
  }

  async ensureScheduled(worldId: string): Promise<void> {
    await this.ensureScheduledForDesiredState(worldId);
    await this.markSchedulerStartSucceeded(worldId);
  }

  async stop(worldId: string): Promise<void> {
    await this.removePendingTick(worldId);
    await this.markStopped(worldId);
  }

  async getObservability(
    worldId: string,
  ): Promise<SimulationSchedulerObservabilityRecord> {
    const runtime = await this.getRuntimeObservability(
      worldId,
      this.connection.status === 'ready' && (this.worker?.isRunning() ?? false),
    );

    return runtime;
  }

  /** Processes a tick and applies retry, cadence, and DLQ policy. */
  async process(job: Job<SimulationCommand>): Promise<void> {
    let command: SimulationCommand;
    try {
      command = simulationCommandSchema.parse(job.data);
    } catch {
      throw new UnrecoverableError('Invalid simulation tick command');
    }

    let worldId: string | undefined;
    try {
      worldId = (await this.worldRepository.findBySlug(command.worldSlug))?.id;
    } catch {
      // Let the runner classify processing errors even if lookup fails.
    }
    if (worldId !== undefined) {
      await this.markTickStarted(worldId);
    }

    let result: Awaited<ReturnType<SimulationRunner['runScheduledTick']>>;
    try {
      result = await this.runner.runScheduledTick(command, job.id);
    } catch (error) {
      if (worldId !== undefined) {
        await this.markTickAttemptCompleted(worldId);
        if (isTransientSchedulerError(error)) {
          await this.markRetry(worldId);
        } else {
          await this.markTickSettled(worldId);
        }
      }
      // Retry transient scheduler faults; dead-letter permanent faults.
      if (isTransientSchedulerError(error)) {
        throw safeSchedulerError(error, 'Simulation tick failed');
      }
      throw new UnrecoverableError(
        safeSchedulerError(error, 'Simulation tick failed').message,
      );
    }

    if (result.status === 'failed') {
      if (worldId !== undefined) {
        await this.markTickAttemptCompleted(worldId);
      }
      if (result.failure.retryable && !this.hasExhaustedAttempts(job)) {
        if (worldId !== undefined) {
          await this.markRetry(worldId);
        }
        throw new Error(
          redactDiagnostics(
            `${result.failure.code}: ${result.failure.message}`,
          ),
        );
      }

      try {
        await this.scheduleNextTick(result.log.worldId);
      } catch (error) {
        if (worldId !== undefined) {
          await this.markTickSettled(worldId);
        }
        throw error;
      }
      if (worldId !== undefined) {
        await this.markTickSettled(worldId);
      }
      return;
    }

    try {
      await this.scheduleNextTick(result.log.worldId);
    } catch (error) {
      if (worldId !== undefined) {
        await this.markTickAttemptCompleted(worldId);
        await this.markTickSettled(worldId);
      }
      throw error;
    }
    if (worldId !== undefined) {
      await this.markTickAttemptCompleted(worldId);
      await this.markTickSettled(worldId);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.queue.close();
    await this.dlq.close();
    await this.connection.quit();
  }

  async recordBootResumeFailure(
    worldId: string,
    error: unknown,
  ): Promise<void> {
    await this.runtimeStateRepository.update(worldId, {
      bootResumeFailure: {
        occurredAt: new Date(),
        reason: redactDiagnostics(
          error instanceof Error ? error.message : 'Scheduler resume failed',
        ),
      },
    });
  }

  async runOneAction(worldSlug: string): Promise<IterationRunResult> {
    return this.runner.runOneAction(worldSlug);
  }

  async runCustomAction(
    input: RunCustomActionInput,
  ): Promise<IterationRunResult> {
    return this.runner.runCustomAction(input);
  }

  private async markSchedulerStartSucceeded(worldId: string): Promise<void> {
    await this.persistRuntimeState(worldId, { bootResumeFailure: null });
  }

  private async markScheduled(
    worldId: string,
    nextTickAt: Date,
  ): Promise<void> {
    await this.persistRuntimeState(worldId, {
      pending: true,
      workExpected: true,
      nextTickAt,
      blockedReason: null,
    });
  }

  private async markExistingTick(
    worldId: string,
    input: { pending: boolean; nextTickAt: Date | null },
  ): Promise<void> {
    await this.persistRuntimeState(worldId, {
      pending: input.pending,
      workExpected: true,
      nextTickAt: input.nextTickAt,
      blockedReason: null,
    });
  }

  private async markBlockedByNoActiveResidents(worldId: string): Promise<void> {
    await this.persistRuntimeState(worldId, {
      pending: false,
      workExpected: false,
      nextTickAt: null,
      blockedReason: 'NO_ACTIVE_RESIDENTS',
    });
  }

  private async markStopped(worldId: string): Promise<void> {
    await this.persistRuntimeState(worldId, {
      pending: false,
      workExpected: false,
      nextTickAt: null,
      retrying: false,
      blockedReason: null,
    });
  }

  private async markTickStarted(worldId: string): Promise<void> {
    await this.persistRuntimeState(worldId, {
      pending: false,
      nextTickAt: null,
      lastTickStartedAt: new Date(),
    });
  }

  private async markTickAttemptCompleted(worldId: string): Promise<void> {
    await this.persistRuntimeState(worldId, {
      lastTickCompletedAt: new Date(),
    });
  }

  private async markTickSettled(worldId: string): Promise<void> {
    await this.persistRuntimeState(worldId, { retrying: false });
  }

  private async markRetry(worldId: string): Promise<void> {
    try {
      await this.runtimeStateRepository.recordRetry(worldId);
    } catch {
      return;
    }
  }

  private async markDeadLettered(
    worldId: string,
    occurredAt: Date,
    reason: string,
  ): Promise<void> {
    try {
      await this.runtimeStateRepository.recordDeadLetter(
        worldId,
        occurredAt,
        reason,
      );
    } catch {
      return;
    }
  }

  private async persistRuntimeState(
    worldId: string,
    input: Parameters<SimulationRuntimeStateRepository['update']>[1],
  ): Promise<void> {
    try {
      await this.runtimeStateRepository.update(worldId, input);
    } catch {
      return;
    }
  }

  private async getRuntimeObservability(
    worldId: string,
    available: boolean,
  ): Promise<SimulationSchedulerObservabilityRecord> {
    const stored =
      (await this.runtimeStateRepository.findByWorldId(worldId)) ??
      emptyRuntimeState(worldId);
    const retryIsRecent =
      stored.lastRetryAt !== null &&
      Date.now() - stored.lastRetryAt.getTime() < RECENT_RETRY_WINDOW_MS;
    return {
      available,
      pending: stored.pending,
      workExpected: stored.workExpected,
      nextTickAt: stored.nextTickAt,
      lastTickStartedAt: stored.lastTickStartedAt,
      lastTickCompletedAt: stored.lastTickCompletedAt,
      retrying: stored.retrying,
      recentRetryCount: retryIsRecent ? stored.recentRetryCount : 0,
      blockedReason: stored.blockedReason,
      deadLetterCount: stored.deadLetterCount,
      lastDeadLetterAt: stored.lastDeadLetterAt,
      lastDeadLetterReason: stored.lastDeadLetterReason,
      bootResumeFailure: stored.bootResumeFailure,
    };
  }

  private async scheduleNextTick(worldId: string): Promise<void> {
    try {
      await this.scheduleTick(worldId);
      await this.markSchedulerStartSucceeded(worldId);
    } catch (error) {
      // Completed ticks are not retried; scheduling faults go to the DLQ.
      throw new UnrecoverableError(
        redactDiagnostics(
          error instanceof Error
            ? error.message
            : 'Failed to schedule next tick',
        ),
      );
    }
  }

  private hasExhaustedAttempts(job: Job): boolean {
    const attempts = job.opts?.attempts ?? this.schedulerConfig.maxAttempts;
    return (job.attemptsMade ?? 0) + 1 >= attempts;
  }

  private async ensureScheduledForDesiredState(worldId: string): Promise<void> {
    const config = await this.lifecycleService.getByWorldId(worldId);
    if (!config || config.state !== 'RUNNING') {
      await this.removePendingTick(worldId);
      await this.markStopped(worldId);
      return;
    }

    const world = await this.worldRepository.findById(worldId);
    if (!world?.isActive) {
      await this.removePendingTick(worldId);
      await this.markStopped(worldId);
      return;
    }

    const actors = await this.castingRepository.findActiveActors(worldId);
    if (actors.length === 0) {
      await this.removePendingTick(worldId);
      await this.markBlockedByNoActiveResidents(worldId);
      return;
    }

    const existing = await this.getCurrentTick(worldId);
    if (existing !== null) {
      await this.markExistingTick(worldId, {
        pending: existing.state !== 'active',
        nextTickAt:
          existing.state === 'active'
            ? null
            : new Date(existing.job.timestamp + existing.job.delay),
      });
      return;
    }

    await this.scheduleTick(worldId);
  }

  private async scheduleTick(worldId: string): Promise<void> {
    const config = await this.lifecycleService.getByWorldId(worldId);
    if (!config || config.state !== 'RUNNING') {
      await this.removePendingTick(worldId);
      await this.markStopped(worldId);
      return;
    }

    const world = await this.worldRepository.findById(worldId);
    if (!world?.isActive) {
      await this.removePendingTick(worldId);
      await this.markStopped(worldId);
      return;
    }

    const actors = await this.castingRepository.findActiveActors(worldId);
    if (actors.length === 0) {
      await this.removePendingTick(worldId);
      await this.markBlockedByNoActiveResidents(worldId);
      return;
    }

    const composed = await this.composeScheduledIteration(worldId);
    if (!composed) {
      return;
    }
    if ('blockedReason' in composed) {
      await this.markBlockedByNoActiveResidents(worldId);
      return;
    }

    const delay = deriveScheduledDelayMs({
      intervalMs: composed.config.intervalMs,
      jitterMs: composed.config.jitterMs,
      speedMultiplier: composed.config.speedMultiplier,
      random: () => this.randomSource.next(),
    });

    const job = await this.queue.add(tickJobName(worldId), composed.iteration, {
      jobId: tickJobId(worldId),
      delay,
      deduplication: { id: worldId, keepLastIfActive: true },
      attempts: this.schedulerConfig.maxAttempts,
      backoff: {
        type: 'exponential',
        delay: this.schedulerConfig.retryBaseDelayMs,
      },
      removeOnComplete: true,
      removeOnFail: false,
    });
    await this.markScheduled(worldId, new Date(job.timestamp + job.delay));
  }

  private async getCurrentTick(worldId: string): Promise<{
    job: Job<SimulationCommand>;
    state: string;
  } | null> {
    const jobId = await this.queue.getDeduplicationJobId(worldId);
    if (jobId === null) {
      return null;
    }

    const job = await this.queue.getJob(jobId);
    if (job === undefined) {
      await this.queue.removeDeduplicationKey(worldId);
      return null;
    }

    return { job, state: await job.getState() };
  }

  private async removePendingTick(worldId: string): Promise<void> {
    const current = await this.getCurrentTick(worldId);
    if (current === null) {
      return;
    }

    if (current.state !== 'active') {
      await current.job.remove().catch(() => undefined);
    }
  }

  private async handleFinalFailure(job: Job, error: Error): Promise<void> {
    const worldId = job.name.startsWith('tick_')
      ? job.name.slice('tick_'.length)
      : '';
    if (worldId.length > 0) {
      await this.markStopped(worldId);
    }
    const deadLetter = await this.deadLetter(job, error);
    if (worldId.length > 0) {
      await this.markDeadLettered(
        worldId,
        deadLetter.occurredAt,
        deadLetter.reason,
      );
    }
  }

  private async deadLetter(
    job: Job,
    error: Error,
  ): Promise<{ occurredAt: Date; reason: string }> {
    const occurredAt = new Date();
    const reason = redactDiagnostics(error?.message ?? 'Unknown failure');
    await this.dlq.add(
      job.name,
      {
        command: job.data ?? null,
        jobId: job.id,
        reason,
        failedAt: occurredAt.toISOString(),
      },
      { removeOnComplete: true },
    );
    return { occurredAt, reason };
  }

  private async composeScheduledIteration(worldId: string): Promise<
    | {
        iteration: SimulationCommand;
        config: WorldSimulationConfigRecord;
      }
    | {
        config: WorldSimulationConfigRecord;
        blockedReason: 'NO_ACTIVE_RESIDENTS';
      }
    | null
  > {
    const config = await this.lifecycleService.getByWorldId(worldId);
    if (!config || config.state !== 'RUNNING') {
      return null;
    }

    let world: WorldRecord;
    try {
      world = await this.requireWorld(worldId);
    } catch (error) {
      if (error instanceof SimulationActionError) {
        return null;
      }
      throw error;
    }
    if (!world.isActive) {
      return null;
    }

    let characterId: string;
    try {
      characterId = (await this.picker.pickCharacter(worldId)).characterId;
    } catch (error) {
      if (error instanceof SimulationIterationPickError) {
        return { config, blockedReason: 'NO_ACTIVE_RESIDENTS' };
      }
      throw error;
    }
    const actionType = await this.picker.pickAutomaticAction(
      worldId,
      config.actionWeights,
    );

    const iteration = simulationCommandSchema.parse({
      worldSlug: world.slug,
      characterId,
      actionType,
      executionSource: 'scheduled',
      issuedAt: new Date().toISOString(),
    });
    return { iteration, config };
  }

  private async requireWorld(worldId: string): Promise<WorldRecord> {
    const world = await this.worldRepository.findById(worldId);
    if (!world) {
      throw new SimulationActionError(
        'WORLD_NOT_FOUND',
        `World "${worldId}" was not found`,
      );
    }
    return world;
  }
}
