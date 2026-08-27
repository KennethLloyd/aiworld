import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';

import { SimulationState } from '@/simulation/lifecycle/domain/simulation-state';
import { WorldSimulationConfigRecord } from '@/simulation/lifecycle/domain/world-simulation-config-record';
import {
  canRunManualWork,
  canSchedule,
  transitionSimulationState,
} from '@/simulation/lifecycle/simulation-lifecycle-rules';
import {
  SimulationConfigNotFoundError,
  SimulationWorkRejectedError,
} from '@/simulation/lifecycle/simulation-lifecycle.error';
import { WorldSimulationConfigRepository } from '@/simulation/lifecycle/world-simulation-config-repository.interface';
import { SimulationScheduler } from '@/simulation/scheduler/simulation-scheduler.port';
import { WorldRepository } from '@/world/repositories/world-repository.interface';
/** Enforces the RUNNING/PAUSED/HALTED lifecycle against persisted
 * WorldSimulationConfig state. State is always read from the repository,
 * never from process memory, and transitions are persisted before success is
 * reported. Transitions drive the scheduler port: entering RUNNING starts
 * scheduled ticks, leaving it stops them. */
@Injectable()
export class SimulationLifecycleService {
  private readonly logger = new Logger(SimulationLifecycleService.name);

  constructor(
    @Inject(WorldSimulationConfigRepository)
    private readonly configRepository: WorldSimulationConfigRepository,
    // Deliberate cycle, not an accident: the lifecycle drives the scheduler
    // (start on RUNNING, stop on PAUSED/HALTED) while the scheduler consults
    // the lifecycle for gates (assertScheduledWorkAllowed /
    // assertManualWorkAllowed) and per-world config. Both directions are
    // runtime-necessary, so forwardRef is the standard Nest mechanism for this
    // genuine bidirectional DI graph.
    @Inject(forwardRef(() => SimulationScheduler))
    private readonly scheduler: SimulationScheduler,
    @Inject(WorldRepository)
    private readonly worldRepository: WorldRepository,
  ) {}

  getByWorldId(worldId: string): Promise<WorldSimulationConfigRecord | null> {
    return this.configRepository.findByWorldId(worldId);
  }

  start(worldId: string): Promise<WorldSimulationConfigRecord> {
    return this.transitionTo(worldId, 'RUNNING');
  }

  pause(worldId: string): Promise<WorldSimulationConfigRecord> {
    return this.transitionTo(worldId, 'PAUSED');
  }

  halt(worldId: string): Promise<WorldSimulationConfigRecord> {
    return this.transitionTo(worldId, 'HALTED');
  }

  async transitionTo(
    worldId: string,
    target: SimulationState,
  ): Promise<WorldSimulationConfigRecord> {
    const config = await this.requireConfig(worldId);
    const next = transitionSimulationState(config.state, target);

    if (target === 'RUNNING') {
      await this.assertWorldActive(worldId, config.state, 'LIFECYCLE');
    }

    const updated = await this.configRepository.transitionState(
      worldId,
      config.state,
      next,
    );

    try {
      await this.driveScheduler(worldId, next);
    } catch (error) {
      // The state was persisted before the scheduler was driven. If the drive
      // fails (for example the queue is unreachable), restore the previous
      // state so the database never claims RUNNING while no tick is scheduled
      // (stuck-RUNNING). A concurrent change during the restore is best-effort.
      await this.restoreState(worldId, next, config.state);
      throw error;
    }

    return updated;
  }

  /** Manual work (Run One Action, Custom Action) requires an active World and
   * a RUNNING or PAUSED config; HALTED rejects it. Returns the persisted config
   * that passed both checks so callers act against the same persisted state. */
  async assertManualWorkAllowed(
    worldId: string,
  ): Promise<WorldSimulationConfigRecord> {
    const config = await this.requireConfig(worldId);
    await this.assertWorldActive(worldId, config.state, 'MANUAL');

    if (!canRunManualWork(config.state)) {
      throw new SimulationWorkRejectedError('MANUAL', config.state);
    }

    return config;
  }

  /** Persist a new speed multiplier after confirming the world has a config.
   * Pacing is read at scheduling time, so the pending tick keeps its cadence
   * and the new multiplier applies to the next scheduled delay. */
  async updateSpeed(
    worldId: string,
    speedMultiplier: number,
  ): Promise<WorldSimulationConfigRecord> {
    await this.requireConfig(worldId);
    return this.configRepository.updateSpeedMultiplier(
      worldId,
      speedMultiplier,
    );
  }
  /** Scheduled ticks require an active World and RUNNING config; PAUSED and
   * HALTED stop scheduled work. */
  async assertScheduledWorkAllowed(
    worldId: string,
  ): Promise<WorldSimulationConfigRecord> {
    const config = await this.requireConfig(worldId);
    await this.assertWorldActive(worldId, config.state, 'SCHEDULED');

    if (!canSchedule(config.state)) {
      throw new SimulationWorkRejectedError('SCHEDULED', config.state);
    }

    return config;
  }

  private async assertWorldActive(
    worldId: string,
    state: SimulationState,
    kind: 'MANUAL' | 'SCHEDULED' | 'LIFECYCLE',
  ): Promise<void> {
    const world = await this.worldRepository.findById(worldId);
    if (!world) {
      throw new SimulationConfigNotFoundError(worldId);
    }

    if (!world.isActive) {
      throw new SimulationWorkRejectedError(kind, state, 'INACTIVE');
    }
  }

  private async driveScheduler(
    worldId: string,
    state: SimulationState,
  ): Promise<void> {
    if (state === 'RUNNING') {
      await this.scheduler.start(worldId);
    } else {
      await this.scheduler.stop(worldId);
    }
  }

  private async restoreState(
    worldId: string,
    from: SimulationState,
    to: SimulationState,
  ): Promise<void> {
    try {
      await this.configRepository.transitionState(worldId, from, to);
    } catch (error) {
      this.logger.warn(
        JSON.stringify({
          event: 'simulation_state_restore_failed',
          worldId,
          errorName: error instanceof Error ? error.name : 'UnknownError',
        }),
      );
    }
  }

  private async requireConfig(
    worldId: string,
  ): Promise<WorldSimulationConfigRecord> {
    const config = await this.configRepository.findByWorldId(worldId);

    if (!config) {
      throw new SimulationConfigNotFoundError(worldId);
    }

    return config;
  }
}
