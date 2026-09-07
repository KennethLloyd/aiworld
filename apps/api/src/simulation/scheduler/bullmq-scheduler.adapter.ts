import { randomUUID } from 'node:crypto';

import {
  deriveScheduledDelayMs,
  simulationCommandSchema,
  SimulationCommand,
} from '@aiworld/shared/schemas/simulation-command.schema';
import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { Job, Queue, UnrecoverableError, Worker } from 'bullmq';
import { Redis as IORedis } from 'ioredis';

import { redactDiagnostics } from '@/common/diagnostics';
import { SimulationLifecycleService } from '@/simulation/lifecycle/simulation-lifecycle.service';
import { SimulationCastingRepository } from '@/simulation/scheduler/simulation-casting-repository.interface';
import { SimulationIterationPicker } from '@/simulation/scheduler/simulation-iteration-picker';
import { SimulationRandomSource } from '@/simulation/scheduler/simulation-random-source';
import { SimulationRunner } from '@/simulation/scheduler/simulation-runner';
import { SimulationRuntimeStateRepository } from '@/simulation/scheduler/simulation-runtime-state-repository.interface';
import {
  SCHEDULER_CONFIG,
  type SchedulerConfig,
} from '@/simulation/scheduler/simulation-scheduler-config';
import { SimulationSchedulerBase } from '@/simulation/scheduler/simulation-scheduler.base';
import { isTransientSchedulerError } from '@/simulation/scheduler/simulation-scheduler.error';
import type { SimulationSchedulerObservabilityRecord } from '@/simulation/scheduler/simulation-scheduler.port';
import { WorldRepository } from '@/world/repositories/world-repository.interface';

export const SIMULATION_TICKS_QUEUE = 'simulation-ticks';
export const SIMULATION_TICKS_DLQ = 'simulation-ticks-dlq';

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

/** BullMQ scheduler adapter for cadence, retries, and DLQ handling. */
@Injectable()
export class BullMqSchedulerAdapter
  extends SimulationSchedulerBase
  implements OnModuleDestroy
{
  private worker: Worker | null = null;

  constructor(
    @Inject(SCHEDULER_CONFIG)
    private readonly schedulerConfig: SchedulerConfig,
    lifecycleService: SimulationLifecycleService,
    worldRepository: WorldRepository,
    picker: SimulationIterationPicker,
    castingRepository: SimulationCastingRepository,
    private readonly randomSource: SimulationRandomSource,
    runner: SimulationRunner,
    runtimeStateRepository: SimulationRuntimeStateRepository,
    private readonly queue: Queue,
    private readonly dlq: Queue,
    private readonly connection: IORedis,
  ) {
    super(
      lifecycleService,
      worldRepository,
      picker,
      castingRepository,
      runner,
      runtimeStateRepository,
    );
  }

  /** Attaches the worker used by the processor callback. */
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
}
