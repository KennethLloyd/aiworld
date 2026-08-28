import {
  simulationCommandSchema,
  SimulationCommand,
} from '@aiworld/shared/schemas/simulation-command.schema';

import { redactDiagnostics } from '@/common/diagnostics';
import { SimulationActionType } from '@/simulation/actions/simulation-action-type';
import { SimulationActionError } from '@/simulation/actions/simulation-action.error';
import { WorldSimulationConfigRecord } from '@/simulation/lifecycle/domain/world-simulation-config-record';
import { SimulationLifecycleService } from '@/simulation/lifecycle/simulation-lifecycle.service';
import { SimulationCastingRepository } from '@/simulation/scheduler/simulation-casting-repository.interface';
import { SimulationIterationPicker } from '@/simulation/scheduler/simulation-iteration-picker';
import type {
  SimulationRuntimeStateRecord,
  SimulationRuntimeStateRepository,
} from '@/simulation/scheduler/simulation-runtime-state-repository.interface';
import {
  SimulationCharacterNotActiveError,
  SimulationIterationPickError,
} from '@/simulation/scheduler/simulation-scheduler.error';
import {
  RunCustomActionInput,
  SimulationScheduler,
  SimulationSchedulerObservabilityRecord,
} from '@/simulation/scheduler/simulation-scheduler.port';
import {
  IterationRunResult,
  SimulationTickRunner,
} from '@/simulation/scheduler/simulation-tick-runner';
import { WorldRecord } from '@/world/domain/world-record';
import { WorldRepository } from '@/world/repositories/world-repository.interface';

const RECENT_RETRY_WINDOW_MS = 15 * 60 * 1_000;

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
    bootResumeFailure: null,
  };
}

/** Shared behavior for both scheduler adapters: the port's manual operations
 * and the scheduled-command composition. Both `runOneAction` and
 * `runCustomAction` build the same serializable `SimulationCommand` that a
 * scheduled tick builds and run it through the same tick runner; `start`/`stop`
 * and the retry policy stay in each adapter because they are transport. Lifecycle
 * rules are never enforced here — the runner's state machine gates decide. */
export abstract class SimulationSchedulerBase extends SimulationScheduler {
  protected constructor(
    protected readonly lifecycleService: SimulationLifecycleService,
    protected readonly worldRepository: WorldRepository,
    protected readonly picker: SimulationIterationPicker,
    protected readonly castingRepository: SimulationCastingRepository,
    protected readonly tickRunner: SimulationTickRunner,
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
    });
  }

  protected async markStopped(worldId: string): Promise<void> {
    await this.persistRuntimeState(worldId, {
      pending: false,
      workExpected: false,
      nextTickAt: null,
      retrying: false,
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
      deadLetterCount: 0,
      lastDeadLetterAt: null,
      lastDeadLetterReason: null,
      bootResumeFailure: stored.bootResumeFailure,
    };
  }

  async runOneAction(worldSlug: string): Promise<IterationRunResult> {
    const command = await this.composeManualCommand(
      worldSlug,
      'one-action',
      {},
    );
    return this.tickRunner.runManualIteration(command);
  }

  async runCustomAction(
    input: RunCustomActionInput,
  ): Promise<IterationRunResult> {
    const command = await this.composeManualCommand(
      input.worldSlug,
      'custom',
      input,
    );
    return this.tickRunner.runManualIteration(command);
  }

  /** Composes the next scheduled tick for an active World with its pacing
   * config, or returns null when the World is inactive, not RUNNING, deleted,
   * or cannot act (no active characters). In all of these cases cadence stops
   * and is resumed by the next `start` or boot. Permanent composition
   * conditions never throw: a throw here would be a job retry and a duplicate
   * run of the identical command. */
  protected async composeScheduledCommand(worldId: string): Promise<{
    command: SimulationCommand;
    config: WorldSimulationConfigRecord;
  } | null> {
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
        return null;
      }
      throw error;
    }
    const actionType = this.picker.pickAction(config.actionWeights);

    const command = simulationCommandSchema.parse({
      worldSlug: world.slug,
      characterId,
      actionType,
      executionSource: 'scheduled',
      issuedAt: new Date().toISOString(),
    });
    return { command, config };
  }

  protected async requireConfig(
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

  protected async requireWorldBySlug(worldSlug: string): Promise<WorldRecord> {
    const world = await this.worldRepository.findBySlug(worldSlug);
    if (!world) {
      throw new SimulationActionError(
        'WORLD_NOT_FOUND',
        `World "${worldSlug}" was not found`,
      );
    }
    return world;
  }

  /** Composes a manual operation (Run One Action / Custom Action) into the same
   * serializable command a scheduled tick builds. The manual-work gate runs
   * before composition so a HALTED World rejects here (409 at the HTTP
   * boundary) even when the picker could not find a character to act. A custom
   * action's explicit character pick is checked against the World's active
   * members before composition, so a foreign character rejects here (400 at
   * the HTTP boundary) instead of silently logging a failed run. Any Character
   * and Automatic are resolved through the picker; the runner's manual-work
   * gate stays as the second line of defense for race windows. */
  private async composeManualCommand(
    worldSlug: string,
    executionSource: 'one-action' | 'custom',
    input: { characterId?: string; actionType?: SimulationActionType },
  ): Promise<SimulationCommand> {
    const world = await this.requireWorldBySlug(worldSlug);
    await this.lifecycleService.assertManualWorkAllowed(world.id);
    const config = await this.requireConfig(world.id);

    if (input.characterId) {
      const isActiveMember = await this.castingRepository.findActiveActor(
        world.id,
        input.characterId,
      );
      if (!isActiveMember) {
        throw new SimulationCharacterNotActiveError(
          input.characterId,
          world.slug,
        );
      }
    }

    const characterId =
      input.characterId ??
      (await this.picker.pickCharacter(world.id)).characterId;
    const actionType =
      input.actionType ?? this.picker.pickAction(config.actionWeights);

    return simulationCommandSchema.parse({
      worldSlug: world.slug,
      characterId,
      actionType,
      executionSource,
      issuedAt: new Date().toISOString(),
    });
  }
}
