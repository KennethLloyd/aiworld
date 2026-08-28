import { Module } from '@nestjs/common';

import { createDefaultSimulationConfig } from '@/lib/config/simulation-config-defaults';
import { WorldResponseMapper } from '@/world/mappers/world-response.mapper';
import { PrismaWorldRepository } from '@/world/repositories/prisma-world.repository';
import {
  WORLD_SIMULATION_CONFIG_DEFAULTS,
  WorldRepository,
} from '@/world/repositories/world-repository.interface';
import { WorldController } from '@/world/world.controller';
import { WorldService } from '@/world/world.service';

@Module({
  controllers: [WorldController],
  providers: [
    {
      provide: WORLD_SIMULATION_CONFIG_DEFAULTS,
      useFactory: createDefaultSimulationConfig,
    },
    {
      provide: WorldRepository,
      useClass: PrismaWorldRepository,
    },
    WorldResponseMapper,
    WorldService,
  ],
  exports: [WorldService, WorldRepository],
})
export class WorldModule {}
