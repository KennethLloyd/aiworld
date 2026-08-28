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

type RuntimeState = {
  worldSlug?: string;
  pending: boolean;
  nextTickAt: Date | null;
  lastTickStartedAt: Date | null;
  lastTickCompletedAt: Date | null;
  retrying: boolean;
  retryTimestamps: Date[];
  bootResumeFailure: {
    occurredAt: Date;
    reason: string;
  } | null;
};

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
  ) {
    super();
  }

  recordBootResumeFailure(worldId: string, error: unknown): void {
    const state = this.runtimeStateFor(worldId);
    state.bootResumeFailure = {
      occurredAt: new Date(),
      reason: redactDiagnostics(
        error instanceof Error ? error.message : 'Scheduler resume failed',
      ),
    };
  }

  protected markSchedulerStartSucceeded(worldId: string): void {
    this.runtimeStateFor(worldId).bootResumeFailure = null;
  }

  protected markScheduled(
    worldId: string,
    nextTickAt: Date,
    worldSlug?: string,
  ): void {
    const state = this.runtimeStateFor(worldId);
    state.pending = true;
    state.nextTickAt = nextTickAt;
    if (worldSlug !== undefined) {
      state.worldSlug = worldSlug;
    }
  }

  protected markStopped(worldId: string): void {
    const state = this.runtimeStateFor(worldId);
    state.pending = false;
    state.nextTickAt = null;
  }

  protected markTickStarted(worldId: string): void {
    const state = this.runtimeStateFor(worldId);
    state.pending = false;
    state.nextTickAt = null;
    state.lastTickStartedAt = new Date();
  }

  protected markTickAttemptCompleted(worldId: string): void {
    this.runtimeStateFor(worldId).lastTickCompletedAt = new Date();
  }

  protected markTickSettled(worldId: string): void {
    this.runtimeStateFor(worldId).retrying = false;
  }

  protected markRetry(worldId: string): void {
    const state = this.runtimeStateFor(worldId);
    state.retrying = true;
    state.retryTimestamps.push(new Date());
  }

  protected getRuntimeObservability(
    worldId: string,
    available: boolean,
  ): SimulationSchedulerObservabilityRecord {
    const state = this.runtimeStateFor(worldId);
    const cutoff = Date.now() - RECENT_RETRY_WINDOW_MS;
    state.retryTimestamps = state.retryTimestamps.filter(
      (timestamp) => timestamp.getTime() >= cutoff,
    );
    return {
      available,
      pending: state.pending,
      nextTickAt: state.nextTickAt,
      lastTickStartedAt: state.lastTickStartedAt,
      lastTickCompletedAt: state.lastTickCompletedAt,
      retrying: state.retrying,
      recentRetryCount: state.retryTimestamps.length,
      deadLetterCount: 0,
      lastDeadLetterAt: null,
      lastDeadLetterReason: null,
      bootResumeFailure: state.bootResumeFailure,
    };
  }

  protected runtimeWorldSlug(worldId: string): string | undefined {
    return this.runtimeStateFor(worldId).worldSlug;
  }

  private readonly runtimeStates = new Map<string, RuntimeState>();

  private runtimeStateFor(worldId: string): RuntimeState {
    let state = this.runtimeStates.get(worldId);
    if (state === undefined) {
      state = {
        pending: false,
        nextTickAt: null,
        lastTickStartedAt: null,
        lastTickCompletedAt: null,
        retrying: false,
        retryTimestamps: [],
        bootResumeFailure: null,
      };
      this.runtimeStates.set(worldId, state);
    }
    return state;
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
