import {
  simulationCommandSchema,
  SimulationCommand as SimulationIteration,
} from '@aiworld/shared/schemas/simulation-command.schema';

import { redactDiagnostics } from '@/common/diagnostics';
import { SimulationActionError } from '@/simulation/actions/simulation-action.error';
import { WorldSimulationConfigRecord } from '@/simulation/lifecycle/domain/world-simulation-config-record';
import { SimulationLifecycleService } from '@/simulation/lifecycle/simulation-lifecycle.service';
import { SimulationCastingRepository } from '@/simulation/scheduler/simulation-casting-repository.interface';
import { SimulationIterationPicker } from '@/simulation/scheduler/simulation-iteration-picker';
import {
  IterationRunResult,
  SimulationRunner,
} from '@/simulation/scheduler/simulation-runner';
import { RECENT_RETRY_WINDOW_MS } from '@/simulation/scheduler/simulation-runtime-signals';
import type {
  SimulationRuntimeStateRecord,
  SimulationRuntimeStateRepository,
} from '@/simulation/scheduler/simulation-runtime-state-repository.interface';
import { SimulationIterationPickError } from '@/simulation/scheduler/simulation-scheduler.error';
import {
  RunCustomActionInput,
  SimulationScheduler,
  SimulationSchedulerObservabilityRecord,
} from '@/simulation/scheduler/simulation-scheduler.port';
import { WorldRecord } from '@/world/domain/world-record';
import { WorldRepository } from '@/world/repositories/world-repository.interface';

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

/** Shared behavior for both scheduler adapters: scheduled iteration composition,
 * runtime observability, and manual port delegation. Cadence, retries, and
 * transport stay in each adapter; the SimulationRunner owns Iteration work. */
export abstract class SimulationSchedulerBase extends SimulationScheduler {
  protected constructor(
    protected readonly lifecycleService: SimulationLifecycleService,
    protected readonly worldRepository: WorldRepository,
    protected readonly picker: SimulationIterationPicker,
    protected readonly castingRepository: SimulationCastingRepository,
    protected readonly runner: SimulationRunner,
    protected readonly runtimeStateRepository: SimulationRuntimeStateRepository,
  ) {
    super();
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

  protected async markSchedulerStartSucceeded(worldId: string): Promise<void> {
    await this.persistRuntimeState(worldId, { bootResumeFailure: null });
  }

  protected async markScheduled(
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

  protected async markExistingTick(
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

  protected async markBlockedByNoActiveResidents(
    worldId: string,
  ): Promise<void> {
    await this.persistRuntimeState(worldId, {
      pending: false,
      workExpected: false,
      nextTickAt: null,
      blockedReason: 'NO_ACTIVE_RESIDENTS',
    });
  }

  protected async markStopped(worldId: string): Promise<void> {
    await this.persistRuntimeState(worldId, {
      pending: false,
      workExpected: false,
      nextTickAt: null,
      retrying: false,
      blockedReason: null,
    });
  }

  protected async markTickStarted(worldId: string): Promise<void> {
    await this.persistRuntimeState(worldId, {
      pending: false,
      nextTickAt: null,
      lastTickStartedAt: new Date(),
    });
  }

  protected async markTickAttemptCompleted(worldId: string): Promise<void> {
    await this.persistRuntimeState(worldId, {
      lastTickCompletedAt: new Date(),
    });
  }

  protected async markTickSettled(worldId: string): Promise<void> {
    await this.persistRuntimeState(worldId, {
      retrying: false,
    });
  }

  protected async markRetry(worldId: string): Promise<void> {
    try {
      await this.runtimeStateRepository.recordRetry(worldId);
    } catch {
      // Runtime health must never turn a provider/content result into a retry.
    }
  }

  protected async markDeadLettered(
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
      // Runtime health is observability; scheduler execution remains primary.
    }
  }

  private async persistRuntimeState(
    worldId: string,
    input: Parameters<SimulationRuntimeStateRepository['update']>[1],
  ): Promise<void> {
    try {
      await this.runtimeStateRepository.update(worldId, input);
    } catch {
      // Runtime health is observability; scheduler execution remains primary.
    }
  }

  protected async getRuntimeObservability(
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

  async runOneAction(worldSlug: string): Promise<IterationRunResult> {
    return this.runner.runOneAction(worldSlug);
  }

  async runCustomAction(
    input: RunCustomActionInput,
  ): Promise<IterationRunResult> {
    return this.runner.runCustomAction(input);
  }

  /** Composes the next scheduled tick for an active World with its pacing
   * config, or returns null when the World is inactive, not RUNNING, or deleted.
   * A World with no active characters returns a blocked result. In all of
   * these cases cadence stops and is resumed by the next reconciliation.
   * Permanent composition conditions never throw: a throw here would be a job
   * retry and a duplicate run of the identical Iteration. */
  protected async composeScheduledIteration(worldId: string): Promise<
    | {
        iteration: SimulationIteration;
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

  protected async requireWorld(worldId: string): Promise<WorldRecord> {
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
