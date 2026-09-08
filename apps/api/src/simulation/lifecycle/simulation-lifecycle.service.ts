import { Injectable, Logger } from '@nestjs/common';

import { Prisma, WorldSimulationConfig } from '@/generated/prisma/client';
import { PrismaService } from '@/lib/database/prisma.service';
import {
  ActionWeights,
  SimulationConfig,
} from '@/simulation/lifecycle/domain/simulation-config';
import { SimulationState } from '@/simulation/lifecycle/domain/simulation-state';
import {
  canRunManualWork,
  canSchedule,
  transitionSimulationState,
} from '@/simulation/lifecycle/simulation-lifecycle-rules';
import {
  SimulationConfigMalformedError,
  SimulationConfigNotFoundError,
  SimulationWorkRejectedError,
} from '@/simulation/lifecycle/simulation-lifecycle.error';

@Injectable()
export class SimulationLifecycleService {
  private readonly logger = new Logger(SimulationLifecycleService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getByWorldId(worldId: string): Promise<SimulationConfig | null> {
    const config = await this.prisma.worldSimulationConfig.findUnique({
      where: { worldId },
    });
    return config ? mapSimulationConfig(config) : null;
  }

  async findWorldIdsByState(
    state: SimulationState,
  ): Promise<Array<{ worldId: string }>> {
    const rows = await this.prisma.worldSimulationConfig.findMany({
      where: { state },
    });

    const worldIds: Array<{ worldId: string }> = [];
    for (const row of rows) {
      try {
        mapSimulationConfig(row);
        worldIds.push({ worldId: row.worldId });
      } catch (error) {
        if (!(error instanceof SimulationConfigMalformedError)) {
          throw error;
        }
        this.logger.warn(
          JSON.stringify({
            event: 'simulation_config_malformed',
            worldId: row.worldId,
            error: error.message,
          }),
        );
      }
    }

    return worldIds;
  }

  start(worldId: string): Promise<SimulationConfig> {
    return this.transitionTo(worldId, 'RUNNING');
  }

  pause(worldId: string): Promise<SimulationConfig> {
    return this.transitionTo(worldId, 'PAUSED');
  }

  halt(worldId: string): Promise<SimulationConfig> {
    return this.transitionTo(worldId, 'HALTED');
  }

  async transitionTo(
    worldId: string,
    target: SimulationState,
  ): Promise<SimulationConfig> {
    const config = await this.requireConfig(worldId);
    const next = transitionSimulationState(config.state, target);

    if (target === 'RUNNING') {
      await this.assertWorldActive(worldId, config.state, 'LIFECYCLE');
    }

    if (config.state === target) {
      return config;
    }

    try {
      const updated = await this.prisma.worldSimulationConfig.update({
        where: { worldId },
        data: { state: next },
      });
      return mapSimulationConfig(updated);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new SimulationConfigNotFoundError(worldId);
      }
      throw error;
    }
  }

  /** Manual work requires an active World and a RUNNING or PAUSED config. */
  async assertManualWorkAllowed(worldId: string): Promise<SimulationConfig> {
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
  ): Promise<SimulationConfig> {
    await this.requireConfig(worldId);
    try {
      const config = await this.prisma.worldSimulationConfig.update({
        where: { worldId },
        data: { speedMultiplier },
      });
      return mapSimulationConfig(config);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new SimulationConfigNotFoundError(worldId);
      }
      throw error;
    }
  }
  /** Scheduled turns require an active World and a RUNNING config. */
  async assertScheduledWorkAllowed(worldId: string): Promise<SimulationConfig> {
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
    const world = await this.prisma.world.findUnique({
      where: { id: worldId },
      select: { isActive: true },
    });
    if (!world) {
      throw new SimulationConfigNotFoundError(worldId);
    }

    if (!world.isActive) {
      throw new SimulationWorkRejectedError(kind, state, 'INACTIVE');
    }
  }

  private async requireConfig(worldId: string): Promise<SimulationConfig> {
    const config = await this.getByWorldId(worldId);

    if (!config) {
      throw new SimulationConfigNotFoundError(worldId);
    }

    return config;
  }
}

function mapSimulationConfig(config: WorldSimulationConfig): SimulationConfig {
  return {
    ...config,
    state: config.state as SimulationState,
    actionWeights: toActionWeights(config.worldId, config.actionWeights),
  };
}

function toActionWeights(
  worldId: string,
  value: Prisma.JsonValue,
): ActionWeights {
  if (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    typeof value.POST === 'number' &&
    typeof value.VOTE === 'number' &&
    typeof value.COMMENT === 'number'
  ) {
    return { POST: value.POST, VOTE: value.VOTE, COMMENT: value.COMMENT };
  }
  throw new SimulationConfigMalformedError(
    worldId,
    'actionWeights must be { POST, VOTE, COMMENT } numbers',
  );
}
