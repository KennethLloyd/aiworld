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
import {
  SCHEDULER_CONFIG,
  type SchedulerConfig,
} from '@/simulation/scheduler/simulation-scheduler-config';
import { SimulationSchedulerBase } from '@/simulation/scheduler/simulation-scheduler.base';
import { isTransientSchedulerError } from '@/simulation/scheduler/simulation-scheduler.error';
import { SimulationTickRunner } from '@/simulation/scheduler/simulation-tick-runner';
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

/** The runtime scheduler adapter. Each World has at most one pending delayed
 * tick: jobs are named `tick:<worldId>` with unique ids, the worker runs at
 * concurrency 1, and the next tick is scheduled only after the current one
 * completes (completion-to-start cadence — never a fixed interval, never
 * `setInterval`). Transient failures retry with exponential backoff up to
 * `maxAttempts`; permanent failures and lifecycle rejections never retry.
 * Jobs that finally fail are dead-lettered to a separate queue. The adapter
 * never calls an LLM provider — it only enqueues and processes commands. */
@Injectable()
export class BullMqSchedulerAdapter
  extends SimulationSchedulerBase
  implements OnModuleDestroy
{
  private worker: Worker | null = null;
  /** The single pending delayed job per World, tracked so `stop` removes it by
   * id instead of scanning the whole queue. Boot resume still scans once,
   * because a previous process left no in-memory record. */
  private readonly pendingTickJobIds = new Map<string, string>();

  constructor(
    @Inject(SCHEDULER_CONFIG)
    private readonly schedulerConfig: SchedulerConfig,
    lifecycleService: SimulationLifecycleService,
    worldRepository: WorldRepository,
    picker: SimulationIterationPicker,
    castingRepository: SimulationCastingRepository,
    private readonly randomSource: SimulationRandomSource,
    tickRunner: SimulationTickRunner,
    private readonly queue: Queue,
    private readonly dlq: Queue,
    private readonly connection: IORedis,
  ) {
    super(
      lifecycleService,
      worldRepository,
      picker,
      castingRepository,
      tickRunner,
    );
  }

  /** Wires the worker after construction so the processor can reference the
   * adapter (the module factory builds the Worker against this instance). */
  attachWorker(worker: Worker): void {
    this.worker = worker;
    worker.on('failed', (job, error) => {
      if (job) {
        void this.deadLetter(job, error).catch(() => undefined);
      }
    });
  }

  async start(worldId: string): Promise<void> {
    const config = await this.requireConfig(worldId);
    if (config.state !== 'RUNNING') {
      return;
    }
    await this.removePendingTicks(worldId);
    this.pendingTickJobIds.delete(worldId);
    await this.enqueueTick(worldId);
  }

  async stop(worldId: string): Promise<void> {
    await this.removeTrackedTick(worldId);
  }

  /** Worker processor: runs the tick and decides the job's fate. A transient
   * failure throws a plain error so BullMQ backs off and retries the same job
   * (same id); a permanent failure or a lifecycle rejection fails the job
   * immediately. Success and rejection schedule the next tick
   * (completion-to-start). */
  async process(job: Job<SimulationCommand>): Promise<void> {
    let command: SimulationCommand;
    try {
      command = simulationCommandSchema.parse(job.data);
    } catch {
      throw new UnrecoverableError('Invalid simulation tick command');
    }

    let result: Awaited<ReturnType<SimulationTickRunner['runScheduledTick']>>;
    try {
      result = await this.tickRunner.runScheduledTick(command, job.id);
    } catch (error) {
      // The runner only throws when logging the attempt itself failed (for
      // example the database is down); retry transient errors, dead-letter
      // permanent ones.
      if (isTransientSchedulerError(error)) {
        throw safeSchedulerError(error, 'Simulation tick failed');
      }
      throw new UnrecoverableError(
        safeSchedulerError(error, 'Simulation tick failed').message,
      );
    }

    if (result.status === 'failed') {
      if (result.failure.retryable) {
        throw new Error(
          redactDiagnostics(
            `${result.failure.code}: ${result.failure.message}`,
          ),
        );
      }
      throw new UnrecoverableError(
        redactDiagnostics(`${result.failure.code}: ${result.failure.message}`),
      );
    }

    await this.scheduleNextTick(result.log.worldId);
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.queue.close();
    await this.dlq.close();
    await this.connection.quit();
  }

  private async scheduleNextTick(worldId: string): Promise<void> {
    try {
      await this.enqueueTick(worldId);
    } catch (error) {
      // A completed tick must never be retried — retrying re-runs the identical
      // command and duplicates content. A scheduling failure dead-letters
      // instead; the World's cadence resumes on the next start or boot.
      throw new UnrecoverableError(
        redactDiagnostics(
          error instanceof Error
            ? error.message
            : 'Failed to schedule next tick',
        ),
      );
    }
  }

  private async enqueueTick(worldId: string): Promise<void> {
    const composed = await this.composeScheduledCommand(worldId);
    if (!composed) {
      return;
    }

    const delay = deriveScheduledDelayMs({
      intervalMs: composed.config.intervalMs,
      jitterMs: composed.config.jitterMs,
      speedMultiplier: composed.config.speedMultiplier,
      random: () => this.randomSource.next(),
    });

    const jobId = tickJobId(worldId);
    await this.queue.add(tickJobName(worldId), composed.command, {
      jobId,
      delay,
      attempts: this.schedulerConfig.maxAttempts,
      backoff: {
        type: 'exponential',
        delay: this.schedulerConfig.retryBaseDelayMs,
      },
      removeOnComplete: true,
      removeOnFail: false,
    });
    this.pendingTickJobIds.set(worldId, jobId);
  }

  /** Removes the single pending delayed tick for a World by its tracked id —
   * O(1) per World, no queue scan on the hot path. Never pauses the queue —
   * there is no burst on resume, only a fresh delayed job. A tick the worker
   * already locked for processing cannot be removed; it is left to complete
   * in-flight, and the executor gate rejects that race window. */
  private async removeTrackedTick(worldId: string): Promise<void> {
    const jobId = this.pendingTickJobIds.get(worldId);
    if (jobId === undefined) {
      return;
    }
    await this.queue.remove(jobId).catch(() => undefined);
    this.pendingTickJobIds.delete(worldId);
  }

  /** Boot resume (and an explicit re-start) cleans up any pending tick left by
   * a previous process, whose job ids this instance cannot know in memory. */
  private async removePendingTicks(worldId: string): Promise<void> {
    const pending = await this.queue.getJobs(['delayed', 'waiting']);
    const jobs = pending.filter((job) => job.name === tickJobName(worldId));
    await Promise.all(jobs.map((job) => job.remove().catch(() => undefined)));
  }

  private async deadLetter(job: Job, error: Error): Promise<void> {
    await this.dlq.add(
      job.name,
      {
        command: job.data ?? null,
        jobId: job.id,
        reason: redactDiagnostics(error?.message ?? 'Unknown failure'),
        failedAt: new Date().toISOString(),
      },
      { removeOnComplete: true },
    );
  }
}
