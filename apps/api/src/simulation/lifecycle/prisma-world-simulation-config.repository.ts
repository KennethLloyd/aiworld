import { Injectable, Logger } from '@nestjs/common';

import { Prisma, WorldSimulationConfig } from '@/generated/prisma/client';
import { PrismaService } from '@/lib/database/prisma.service';
import { SimulationState } from '@/simulation/lifecycle/domain/simulation-state';
import {
  ActionWeights,
  WorldSimulationConfigRecord,
} from '@/simulation/lifecycle/domain/world-simulation-config-record';
import {
  SimulationConfigMalformedError,
  SimulationConfigNotFoundError,
} from '@/simulation/lifecycle/simulation-lifecycle.error';
import { WorldSimulationConfigRepository } from '@/simulation/lifecycle/world-simulation-config-repository.interface';

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
    return {
      POST: value.POST,
      VOTE: value.VOTE,
      COMMENT: value.COMMENT,
    };
  }

  throw new SimulationConfigMalformedError(
    worldId,
    'actionWeights must be { POST, VOTE, COMMENT } numbers',
  );
}

@Injectable()
export class PrismaWorldSimulationConfigRepository extends WorldSimulationConfigRepository {
  private readonly logger = new Logger(
    PrismaWorldSimulationConfigRepository.name,
  );

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  private mapToRecord(
    config: WorldSimulationConfig,
  ): WorldSimulationConfigRecord {
    return {
      id: config.id,
      worldId: config.worldId,
      state: config.state as SimulationState,
      speedMultiplier: config.speedMultiplier,
      intervalMs: config.intervalMs,
      jitterMs: config.jitterMs,
      actionWeights: toActionWeights(config.worldId, config.actionWeights),
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    };
  }

  async findByWorldId(
    worldId: string,
  ): Promise<WorldSimulationConfigRecord | null> {
    const row = await this.prisma.worldSimulationConfig.findUnique({
      where: { worldId },
    });

    return row ? this.mapToRecord(row) : null;
  }

  async findAllByState(
    state: SimulationState,
  ): Promise<WorldSimulationConfigRecord[]> {
    const rows = await this.prisma.worldSimulationConfig.findMany({
      where: { state },
    });

    const configs: WorldSimulationConfigRecord[] = [];
    for (const row of rows) {
      try {
        configs.push(this.mapToRecord(row));
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

    return configs;
  }

  async setState(
    worldId: string,
    state: SimulationState,
  ): Promise<WorldSimulationConfigRecord> {
    try {
      const row = await this.prisma.worldSimulationConfig.update({
        where: { worldId },
        data: { state },
      });

      return this.mapToRecord(row);
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

  async updateSpeedMultiplier(
    worldId: string,
    speedMultiplier: number,
  ): Promise<WorldSimulationConfigRecord> {
    const result = await this.prisma.worldSimulationConfig.updateMany({
      where: { worldId },
      data: { speedMultiplier },
    });

    if (result.count === 0) {
      throw new SimulationConfigNotFoundError(worldId);
    }

    const row = await this.prisma.worldSimulationConfig.findUnique({
      where: { worldId },
    });

    if (!row) {
      throw new SimulationConfigNotFoundError(worldId);
    }

    return this.mapToRecord(row);
  }
}
