import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';

import { WorldSimulationConfigRepository } from '@/simulation/lifecycle/world-simulation-config-repository.interface';
import { SimulationScheduler } from '@/simulation/scheduler/simulation-scheduler.port';
import { WorldRepository } from '@/world/repositories/world-repository.interface';
/** On app boot, resumes scheduled ticks for persisted RUNNING configurations
 * only when their World is active. This is best-effort: a queue or database
 * outage at boot must not crash the API — the World stays RUNNING in the
 * database and is restarted on the next boot or an explicit start. */
const RECONCILIATION_INTERVAL_MS = 60_000;

@Injectable()
export class SimulationSchedulerBootstrap
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(SimulationSchedulerBootstrap.name);
  private reconciliationTimer: NodeJS.Timeout | null = null;
  private reconciliationInFlight: Promise<void> | null = null;

  constructor(
    @Inject(WorldSimulationConfigRepository)
    private readonly configRepository: WorldSimulationConfigRepository,
    private readonly scheduler: SimulationScheduler,
    @Inject(WorldRepository)
    private readonly worldRepository: WorldRepository,
  ) {}

  async onModuleInit(): Promise<void> {
    this.reconciliationTimer = setInterval(() => {
      void this.reconcileRunningWorlds();
    }, RECONCILIATION_INTERVAL_MS);
    this.reconciliationTimer.unref();
    await this.reconcileRunningWorlds();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.reconciliationTimer !== null) {
      clearInterval(this.reconciliationTimer);
      this.reconciliationTimer = null;
    }
    await this.reconciliationInFlight;
  }

  private reconcileRunningWorlds(): Promise<void> {
    if (this.reconciliationInFlight !== null) {
      return this.reconciliationInFlight;
    }

    const reconciliation = this.reconcileRunningWorldsNow().finally(() => {
      if (this.reconciliationInFlight === reconciliation) {
        this.reconciliationInFlight = null;
      }
    });
    this.reconciliationInFlight = reconciliation;
    return reconciliation;
  }

  private async reconcileRunningWorldsNow(): Promise<void> {
    let running: Array<{ worldId: string }>;
    try {
      running = await this.configRepository.findAllByState('RUNNING');
    } catch (error) {
      this.logger.warn(
        JSON.stringify({
          event: 'simulation_reconciliation_read_failed',
          errorName: error instanceof Error ? error.name : 'UnknownError',
        }),
      );
      return;
    }

    for (const config of running) {
      try {
        const world = await this.worldRepository.findById(config.worldId);
        if (!world?.isActive) {
          continue;
        }

        await this.scheduler.ensureScheduled(config.worldId);
      } catch (error) {
        try {
          await this.scheduler.recordBootResumeFailure(config.worldId, error);
        } catch (recordError) {
          this.logger.warn(
            JSON.stringify({
              event: 'simulation_reconciliation_failure_record_failed',
              worldId: config.worldId,
              errorName:
                recordError instanceof Error
                  ? recordError.name
                  : 'UnknownError',
            }),
          );
        }
        this.logger.warn(
          JSON.stringify({
            event: 'simulation_reconciliation_failed',
            worldId: config.worldId,
            errorName: error instanceof Error ? error.name : 'UnknownError',
          }),
        );
      }
    }
  }
}
