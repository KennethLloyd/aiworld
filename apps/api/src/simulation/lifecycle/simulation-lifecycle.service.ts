import { Inject, Injectable } from '@nestjs/common';

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
import { WorldRepository } from '@/world/repositories/world-repository.interface';

@Injectable()
export class SimulationLifecycleService {
  constructor(
    @Inject(WorldSimulationConfigRepository)
    private readonly configRepository: WorldSimulationConfigRepository,
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

    if (config.state === target) {
      return config;
    }

    return this.configRepository.setState(worldId, next);
  }

  /** Manual work requires an active World and a RUNNING or PAUSED config. */
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

  /** Persist a speed multiplier for the next scheduled delay. */
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
  /** Scheduled ticks require an active World and a RUNNING config. */
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
