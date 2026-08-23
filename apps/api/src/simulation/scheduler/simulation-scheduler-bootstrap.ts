import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';

import { WorldSimulationConfigRepository } from '@/simulation/lifecycle/world-simulation-config-repository.interface';
import { SimulationScheduler } from '@/simulation/scheduler/simulation-scheduler.port';

/** On app boot, resumes scheduled ticks for every persisted RUNNING world.
 * This is best-effort: a queue or database outage at boot must not crash the
 * API — the world stays RUNNING in the database and is restarted on the next
 * boot or an explicit start. */
@Injectable()
export class SimulationSchedulerBootstrap implements OnModuleInit {
  private readonly logger = new Logger(SimulationSchedulerBootstrap.name);

  constructor(
    @Inject(WorldSimulationConfigRepository)
    private readonly configRepository: WorldSimulationConfigRepository,
    private readonly scheduler: SimulationScheduler,
  ) {}

  async onModuleInit(): Promise<void> {
    let running: Array<{ worldId: string }>;
    try {
      running = await this.configRepository.findAllByState('RUNNING');
    } catch (error) {
      this.logger.warn(
        JSON.stringify({
          event: 'simulation_bootstrap_read_failed',
          errorName: error instanceof Error ? error.name : 'UnknownError',
        }),
      );
      return;
    }

    for (const config of running) {
      try {
        await this.scheduler.start(config.worldId);
      } catch (error) {
        this.logger.warn(
          JSON.stringify({
            event: 'simulation_bootstrap_resume_failed',
            worldId: config.worldId,
            errorName: error instanceof Error ? error.name : 'UnknownError',
          }),
        );
      }
    }
  }
}
