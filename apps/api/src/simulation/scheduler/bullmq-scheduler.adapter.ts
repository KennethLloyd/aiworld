import { randomUUID } from 'node:crypto';

import {
  deriveScheduledDelayMs,
  simulationCommandSchema,
  SimulationCommand,
} from '@aiworld/shared/schemas/simulation-command.schema';
import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { Job, Queue, UnrecoverableError, Worker } from 'bullmq';
import { Redis as IORedis } from 'ioredis';

import { SimulationActionError } from '@/simulation/actions/simulation-action.error';
import { WorldSimulationConfigRecord } from '@/simulation/lifecycle/domain/world-simulation-config-record';
import { SimulationLifecycleService } from '@/simulation/lifecycle/simulation-lifecycle.service';
import { SimulationIterationPicker } from '@/simulation/scheduler/simulation-iteration-picker';
import { SimulationRandomSource } from '@/simulation/scheduler/simulation-random-source';
import {
  SCHEDULER_CONFIG,
  type SchedulerConfig,
} from '@/simulation/scheduler/simulation-scheduler-config';
import {
  RunCustomActionInput,
  SimulationScheduler,
} from '@/simulation/scheduler/simulation-scheduler.port';
import {
  IterationRunResult,
  ScheduledTickRunResult,
  SimulationTickRunner,
} from '@/simulation/scheduler/simulation-tick-runner';
import { WorldRecord } from '@/world/domain/world-record';
import { WorldRepository } from '@/world/repositories/world-repository.interface';

export const SIMULATION_TICKS_QUEUE = 'simulation-ticks';
export const SIMULATION_TICKS_DLQ = 'simulation-ticks-dlq';

function tickJobName(worldId: string): string {
  return `tick_${worldId}`;
}

function tickJobId(worldId: string): string {
  return `${tickJobName(worldId)}_${randomUUID()}`;
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
  extends SimulationScheduler
  implements OnModuleDestroy
{
  private worker: Worker | null = null;

  constructor(
    @Inject(SCHEDULER_CONFIG)
    private readonly schedulerConfig: SchedulerConfig,
    private readonly lifecycleService: SimulationLifecycleService,
    private readonly worldRepository: WorldRepository,
    private readonly picker: SimulationIterationPicker,
    private readonly randomSource: SimulationRandomSource,
    private readonly tickRunner: SimulationTickRunner,
    private readonly queue: Queue,
    private readonly dlq: Queue,
    private readonly connection: IORedis,
  ) {
    super();
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
    await this.enqueueTick(worldId);
  }

  async stop(worldId: string): Promise<void> {
    await this.removePendingTicks(worldId);
  }

  async runOneAction(worldSlug: string): Promise<IterationRunResult> {
    return this.tickRunner.runManualIteration({
      worldSlug,
      executionSource: 'one-action',
    });
  }

  async runCustomAction(
    input: RunCustomActionInput,
  ): Promise<IterationRunResult> {
    return this.tickRunner.runManualIteration({
      worldSlug: input.worldSlug,
      characterId: input.characterId,
      actionType: input.actionType,
      executionSource: 'custom',
    });
  }

  /** Worker processor: runs the tick and decides the job's fate. Throwing a
   * retryable error lets BullMQ back off and retry the same job (same id);
   * throwing UnrecoverableError fails the job immediately. Success and
   * lifecycle rejection schedule the next tick (completion-to-start). */
  async process(job: Job<SimulationCommand>): Promise<void> {
    let command: SimulationCommand;
    try {
      command = simulationCommandSchema.parse(job.data);
    } catch {
      throw new UnrecoverableError('Invalid simulation tick command');
    }

    let result: ScheduledTickRunResult;
    try {
      result = await this.tickRunner.runScheduledTick({
        worldSlug: command.worldSlug,
        characterId: command.characterId,
        actionType: command.actionType,
        executionSource: command.executionSource,
        jobId: job.id,
      });
    } catch (error) {
      throw new UnrecoverableError(
        error instanceof Error ? error.message : 'Simulation tick failed',
      );
    }

    if (result.status === 'failed') {
      if (result.failure.retryable) {
        throw new Error(`${result.failure.code}: ${result.failure.message}`);
      }
      throw new UnrecoverableError(
        `${result.failure.code}: ${result.failure.message}`,
      );
    }

    await this.enqueueTick(result.log.worldId);
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.queue.close();
    await this.dlq.close();
    await this.connection.quit();
  }

  private async enqueueTick(worldId: string): Promise<void> {
    const config = await this.requireConfig(worldId);
    if (config.state !== 'RUNNING') {
      return;
    }
    const world = await this.requireWorld(worldId);

    const { characterId } = await this.picker.pickCharacter(worldId);
    const actionType = this.picker.pickAction(config.actionWeights);
    const delay = deriveScheduledDelayMs({
      intervalMs: config.intervalMs,
      jitterMs: config.jitterMs,
      speedMultiplier: config.speedMultiplier,
      random: () => this.randomSource.next(),
    });

    const command = simulationCommandSchema.parse({
      worldSlug: world.slug,
      characterId,
      actionType,
      executionSource: 'scheduled',
      issuedAt: new Date().toISOString(),
    });

    await this.queue.add(tickJobName(worldId), command, {
      jobId: tickJobId(worldId),
      delay,
      attempts: this.schedulerConfig.maxAttempts,
      backoff: {
        type: 'exponential',
        delay: this.schedulerConfig.retryBaseDelayMs,
      },
      removeOnComplete: true,
      removeOnFail: false,
    });
  }

  /** Removes the single pending delayed tick for a World. Never pauses the
   * queue — there is no burst on resume, only a fresh delayed job. A tick the
   * worker already locked for processing cannot be removed; it is left to
   * complete in-flight, and the executor gate rejects that race window. */
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
        reason: error?.message ?? 'Unknown failure',
        failedAt: new Date().toISOString(),
      },
      { removeOnComplete: true },
    );
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

  private async requireConfig(
    worldId: string,
  ): Promise<WorldSimulationConfigRecord> {
    const config = await this.lifecycleService.getByWorldId(worldId);
    if (!config) {
      throw new SimulationActionError(
        'WORLD_NOT_FOUND',
        `No simulation configuration for world "${worldId}"`,
      );
    }
    return config;
  }
}
