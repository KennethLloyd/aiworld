import { forwardRef, Inject, Injectable } from '@nestjs/common';

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

/** Enforces the RUNNING/PAUSED/HALTED lifecycle against persisted
 * WorldSimulationConfig state. State is always read from the repository,
 * never from process memory, and transitions are persisted before success is
 * reported. Transitions drive the scheduler port: entering RUNNING starts
 * scheduled ticks, leaving it stops them. */
@Injectable()
export class SimulationLifecycleService {
  constructor(
    @Inject(WorldSimulationConfigRepository)
    private readonly configRepository: WorldSimulationConfigRepository,
    @Inject(forwardRef(() => SimulationScheduler))
    private readonly scheduler: SimulationScheduler,
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

    const updated = await this.configRepository.transitionState(
      worldId,
      config.state,
      next,
    );
    await this.driveScheduler(worldId, next);

    return updated;
  }

  /** Manual work (Run One Action, Custom Action) requires RUNNING or PAUSED;
   * HALTED rejects it. Returns the persisted config that passed the check so
   * callers act against the same persisted state. */
  async assertManualWorkAllowed(
    worldId: string,
  ): Promise<WorldSimulationConfigRecord> {
    const config = await this.requireConfig(worldId);

    if (!canRunManualWork(config.state)) {
      throw new SimulationWorkRejectedError('MANUAL', config.state);
    }

    return config;
  }

  /** Scheduled ticks require RUNNING; PAUSED and HALTED stop scheduled work. */
  async assertScheduledWorkAllowed(
    worldId: string,
  ): Promise<WorldSimulationConfigRecord> {
    const config = await this.requireConfig(worldId);

    if (!canSchedule(config.state)) {
      throw new SimulationWorkRejectedError('SCHEDULED', config.state);
    }

    return config;
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
