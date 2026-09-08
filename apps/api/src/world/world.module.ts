import { Module } from '@nestjs/common';

import { createDefaultSimulationConfig } from '@/lib/config/simulation-config-defaults';
import { WorldController } from '@/world/world.controller';
import { WorldService } from '@/world/world.service';
import { WORLD_SIMULATION_CONFIG_DEFAULTS } from '@/world/world.tokens';

@Module({
  controllers: [WorldController],
  providers: [
    {
      provide: WORLD_SIMULATION_CONFIG_DEFAULTS,
      useFactory: createDefaultSimulationConfig,
    },
    WorldService,
  ],
  exports: [WorldService],
})
export class WorldModule {}
