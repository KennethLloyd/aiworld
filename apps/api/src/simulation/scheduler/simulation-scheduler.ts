import { randomUUID } from 'node:crypto';

import {
  deriveScheduledDelayMs,
  scheduledTurnSchema,
} from '@aiworld/shared/schemas/simulation-iteration.schema';
import type { ScheduledTurn } from '@aiworld/shared/schemas/simulation-iteration.schema';
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
import type { SimulationConfig } from '@/simulation/lifecycle/domain/simulation-config';
import { SimulationLifecycleService } from '@/simulation/lifecycle/simulation-lifecycle.service';
import { SimulationIterationPicker } from '@/simulation/scheduler/simulation-iteration-picker';
import { SimulationRandomSource } from '@/simulation/scheduler/simulation-random-source';
import { SimulationRunner } from '@/simulation/scheduler/simulation-runner';
import type { IterationRunResult } from '@/simulation/scheduler/simulation-runner';
import { RECENT_RETRY_WINDOW_MS } from '@/simulation/scheduler/simulation-runtime-signals';
import type { SimulationRuntimeSignals } from '@/simulation/scheduler/simulation-runtime-signals';
import {
  SimulationRuntimeState,
  SimulationRuntimeStateService,
  SimulationRuntimeStateUpdate,
} from '@/simulation/scheduler/simulation-runtime-state.service';
import {
  SCHEDULER_CONFIG,
  type SchedulerConfig,
} from '@/simulation/scheduler/simulation-scheduler-config';
import {
  isTransientSchedulerError,
  SimulationIterationPickError,
} from '@/simulation/scheduler/simulation-scheduler.error';
import {
  SIMULATION_DLQ,
  SIMULATION_QUEUE,
  SIMULATION_REDIS,
} from '@/simulation/scheduler/simulation-tokens';
import { WorldService, WorldView } from '@/world/world.service';

export const SIMULATION_TURNS_QUEUE = 'simulation-turns';
export const SIMULATION_TURNS_DLQ = 'simulation-turns-dlq';
export { SIMULATION_DLQ, SIMULATION_QUEUE, SIMULATION_REDIS };

function emptyRuntimeState(worldId: string): SimulationRuntimeState {
  return {
    worldId,
    pending: false,
    workExpected: false,
    nextTurnAt: null,
    lastTurnStartedAt: null,
    lastTurnCompletedAt: null,
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

export type SimulationSchedulerObservability = SimulationRuntimeSignals & {
  available: boolean;
};

function turnJobName(worldId: string): string {
  return `turn_${worldId}`;
}

function turnJobId(worldId: string): string {
  return `${turnJobName(worldId)}_${randomUUID()}`;
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
    private readonly worldService: WorldService,
    private readonly picker: SimulationIterationPicker,
    private readonly randomSource: SimulationRandomSource,
    private readonly runner: SimulationRunner,
    private readonly runtimeStateService: SimulationRuntimeStateService,
    @Inject(SIMULATION_QUEUE)
    private readonly queue: Queue,
    @Inject(SIMULATION_DLQ)
    private readonly dlq: Queue,
    @Inject(SIMULATION_REDIS)
    private readonly connection: IORedis,
  ) {}

  onModuleInit(): void {
    this.attachWorker(
      new Worker(SIMULATION_TURNS_QUEUE, (job) => this.process(job), {
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
    await this.removePendingTurn(worldId);
    await this.markStopped(worldId);
  }

  async getObservability(
    worldId: string,
  ): Promise<SimulationSchedulerObservability> {
    const runtime = await this.getRuntimeObservability(
      worldId,
      this.connection.status === 'ready' && (this.worker?.isRunning() ?? false),
    );

    return runtime;
  }

  /** Processes a turn and applies retry, cadence, and DLQ policy. */
  async process(job: Job<ScheduledTurn>): Promise<void> {
    let turn: ScheduledTurn;
    try {
      turn = scheduledTurnSchema.parse(job.data);
    } catch {
      throw new UnrecoverableError('Invalid scheduled turn');
    }

    let worldId: string | undefined;
    try {
      worldId = (await this.worldService.getBySlug(turn.worldSlug, true))?.id;
    } catch {
      // Let the runner classify processing errors even if lookup fails.
    }
    if (worldId !== undefined) {
      await this.markTurnStarted(worldId);
    }

    let result: Awaited<ReturnType<SimulationRunner['runScheduledTurn']>>;
    try {
      result = await this.runner.runScheduledTurn(turn, job.id);
    } catch (error) {
      if (worldId !== undefined) {
        await this.markTurnAttemptCompleted(worldId);
        if (isTransientSchedulerError(error)) {
          await this.markRetry(worldId);
        } else {
          await this.markTurnSettled(worldId);
        }
      }
      // Retry transient scheduler faults; dead-letter permanent faults.
      if (isTransientSchedulerError(error)) {
        throw safeSchedulerError(error, 'Simulation turn failed');
      }
      throw new UnrecoverableError(
        safeSchedulerError(error, 'Simulation turn failed').message,
      );
    }

    if (result.status === 'failed') {
      if (worldId !== undefined) {
        await this.markTurnAttemptCompleted(worldId);
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
        await this.scheduleNextTurn(result.log.worldId);
      } catch (error) {
        if (worldId !== undefined) {
          await this.markTurnSettled(worldId);
        }
        throw error;
      }
      if (worldId !== undefined) {
        await this.markTurnSettled(worldId);
      }
      return;
    }

    try {
      await this.scheduleNextTurn(result.log.worldId);
    } catch (error) {
      if (worldId !== undefined) {
        await this.markTurnAttemptCompleted(worldId);
        await this.markTurnSettled(worldId);
      }
      throw error;
    }
    if (worldId !== undefined) {
      await this.markTurnAttemptCompleted(worldId);
      await this.markTurnSettled(worldId);
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
    await this.runtimeStateService.update(worldId, {
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
    nextTurnAt: Date,
  ): Promise<void> {
    await this.persistRuntimeState(worldId, {
      pending: true,
      workExpected: true,
      nextTurnAt,
      blockedReason: null,
    });
  }

  private async markExistingTurn(
    worldId: string,
    input: { pending: boolean; nextTurnAt: Date | null },
  ): Promise<void> {
    await this.persistRuntimeState(worldId, {
      pending: input.pending,
      workExpected: true,
      nextTurnAt: input.nextTurnAt,
      blockedReason: null,
    });
  }

  private async markBlockedByNoActiveResidents(worldId: string): Promise<void> {
    await this.persistRuntimeState(worldId, {
      pending: false,
      workExpected: false,
      nextTurnAt: null,
      blockedReason: 'NO_ACTIVE_RESIDENTS',
    });
  }

  private async markStopped(worldId: string): Promise<void> {
    await this.persistRuntimeState(worldId, {
      pending: false,
      workExpected: false,
      nextTurnAt: null,
      retrying: false,
      blockedReason: null,
    });
  }

  private async markTurnStarted(worldId: string): Promise<void> {
    await this.persistRuntimeState(worldId, {
      pending: false,
      nextTurnAt: null,
      lastTurnStartedAt: new Date(),
    });
  }

  private async markTurnAttemptCompleted(worldId: string): Promise<void> {
    await this.persistRuntimeState(worldId, {
      lastTurnCompletedAt: new Date(),
    });
  }

  private async markTurnSettled(worldId: string): Promise<void> {
    await this.persistRuntimeState(worldId, { retrying: false });
  }

  private async markRetry(worldId: string): Promise<void> {
    try {
      await this.runtimeStateService.recordRetry(worldId);
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
      await this.runtimeStateService.recordDeadLetter(
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
    input: SimulationRuntimeStateUpdate,
  ): Promise<void> {
    try {
      await this.runtimeStateService.update(worldId, input);
    } catch {
      return;
    }
  }

  private async getRuntimeObservability(
    worldId: string,
    available: boolean,
  ): Promise<SimulationSchedulerObservability> {
    const stored =
      (await this.runtimeStateService.findByWorldId(worldId)) ??
      emptyRuntimeState(worldId);
    const retryIsRecent =
      stored.lastRetryAt !== null &&
      Date.now() - stored.lastRetryAt.getTime() < RECENT_RETRY_WINDOW_MS;
    return {
      available,
      pending: stored.pending,
      workExpected: stored.workExpected,
      nextTurnAt: stored.nextTurnAt,
      lastTurnStartedAt: stored.lastTurnStartedAt,
      lastTurnCompletedAt: stored.lastTurnCompletedAt,
      retrying: stored.retrying,
      recentRetryCount: retryIsRecent ? stored.recentRetryCount : 0,
      blockedReason: stored.blockedReason,
      deadLetterCount: stored.deadLetterCount,
      lastDeadLetterAt: stored.lastDeadLetterAt,
      lastDeadLetterReason: stored.lastDeadLetterReason,
      bootResumeFailure: stored.bootResumeFailure,
    };
  }

  private async scheduleNextTurn(worldId: string): Promise<void> {
    try {
      await this.scheduleTurn(worldId);
      await this.markSchedulerStartSucceeded(worldId);
    } catch (error) {
      // Completed turns are not retried; scheduling faults go to the DLQ.
      throw new UnrecoverableError(
        redactDiagnostics(
          error instanceof Error
            ? error.message
            : 'Failed to schedule next turn',
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
      await this.removePendingTurn(worldId);
      await this.markStopped(worldId);
      return;
    }

    const world = await this.worldService.findById(worldId);
    if (!world?.isActive) {
      await this.removePendingTurn(worldId);
      await this.markStopped(worldId);
      return;
    }

    if (!(await this.picker.hasActiveActors(worldId))) {
      await this.removePendingTurn(worldId);
      await this.markBlockedByNoActiveResidents(worldId);
      return;
    }

    const existing = await this.getCurrentTurn(worldId);
    if (existing !== null) {
      await this.markExistingTurn(worldId, {
        pending: existing.state !== 'active',
        nextTurnAt:
          existing.state === 'active'
            ? null
            : new Date(existing.job.timestamp + existing.job.delay),
      });
      return;
    }

    await this.scheduleTurn(worldId);
  }

  private async scheduleTurn(worldId: string): Promise<void> {
    const config = await this.lifecycleService.getByWorldId(worldId);
    if (!config || config.state !== 'RUNNING') {
      await this.removePendingTurn(worldId);
      await this.markStopped(worldId);
      return;
    }

    const world = await this.worldService.findById(worldId);
    if (!world?.isActive) {
      await this.removePendingTurn(worldId);
      await this.markStopped(worldId);
      return;
    }

    if (!(await this.picker.hasActiveActors(worldId))) {
      await this.removePendingTurn(worldId);
      await this.markBlockedByNoActiveResidents(worldId);
      return;
    }

    const composed = await this.composeScheduledTurn(worldId);
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

    const job = await this.queue.add(turnJobName(worldId), composed.turn, {
      jobId: turnJobId(worldId),
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

  private async getCurrentTurn(worldId: string): Promise<{
    job: Job<ScheduledTurn>;
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

  private async removePendingTurn(worldId: string): Promise<void> {
    const current = await this.getCurrentTurn(worldId);
    if (current === null) {
      return;
    }

    if (current.state !== 'active') {
      await current.job.remove().catch(() => undefined);
    }
  }

  private async handleFinalFailure(job: Job, error: Error): Promise<void> {
    const worldId = job.name.startsWith('turn_')
      ? job.name.slice('turn_'.length)
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
        turn: job.data ?? null,
        jobId: job.id,
        reason,
        failedAt: occurredAt.toISOString(),
      },
      { removeOnComplete: true },
    );
    return { occurredAt, reason };
  }

  private async composeScheduledTurn(worldId: string): Promise<
    | {
        turn: ScheduledTurn;
        config: SimulationConfig;
      }
    | {
        config: SimulationConfig;
        blockedReason: 'NO_ACTIVE_RESIDENTS';
      }
    | null
  > {
    const config = await this.lifecycleService.getByWorldId(worldId);
    if (!config || config.state !== 'RUNNING') {
      return null;
    }

    let world: WorldView;
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

    const turn = scheduledTurnSchema.parse({
      worldSlug: world.slug,
      characterId,
      actionType,
      executionSource: 'scheduled',
      issuedAt: new Date().toISOString(),
    });
    return { turn, config };
  }

  private async requireWorld(worldId: string): Promise<WorldView> {
    const world = await this.worldService.findById(worldId);
    if (!world) {
      throw new SimulationActionError(
        'WORLD_NOT_FOUND',
        `World "${worldId}" was not found`,
      );
    }
    return world;
  }
}
