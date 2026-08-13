import {
  simulationCommandSchema,
  SimulationCommand,
} from '@aiworld/shared/schemas/simulation-command.schema';

import { SimulationActionType } from '@/simulation/actions/simulation-action-type';
import { SimulationActionError } from '@/simulation/actions/simulation-action.error';
import { WorldSimulationConfigRecord } from '@/simulation/lifecycle/domain/world-simulation-config-record';
import { SimulationLifecycleService } from '@/simulation/lifecycle/simulation-lifecycle.service';
import { SimulationIterationPicker } from '@/simulation/scheduler/simulation-iteration-picker';
import { SimulationIterationPickError } from '@/simulation/scheduler/simulation-scheduler.error';
import {
  RunCustomActionInput,
  SimulationScheduler,
} from '@/simulation/scheduler/simulation-scheduler.port';
import {
  IterationRunResult,
  SimulationTickRunner,
} from '@/simulation/scheduler/simulation-tick-runner';
import { WorldRecord } from '@/world/domain/world-record';
import { WorldRepository } from '@/world/repositories/world-repository.interface';

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
    protected readonly tickRunner: SimulationTickRunner,
  ) {
    super();
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

  /** Composes the next scheduled tick for a World along with its pacing
   * config, or returns null when the World is not RUNNING, was deleted, or
   * cannot act (no active residents) — in all of these the cadence simply
   * stops and is resumed by the next `start` or boot. Permanent composition
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
   * serializable command a scheduled tick builds. Any Resident and Automatic
   * are resolved through the picker; a HALTED World is rejected downstream by
   * the runner's manual-work gate, never here. */
  private async composeManualCommand(
    worldSlug: string,
    executionSource: 'one-action' | 'custom',
    input: { characterId?: string; actionType?: SimulationActionType },
  ): Promise<SimulationCommand> {
    const world = await this.requireWorldBySlug(worldSlug);
    const config = await this.requireConfig(world.id);

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
