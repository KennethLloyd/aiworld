import { Paginated } from '@aiworld/shared/schemas/pagination.schema';
import { Injectable } from '@nestjs/common';

import { SimulationActionError } from '@/simulation/actions/simulation-action.error';
import {
  deriveSimulationHealth,
  normalizeProviderExecutionTimestamps,
  SimulationHealth,
} from '@/simulation/admin/simulation-health';
import {
  emptySimulationTelemetry,
  SimulationTelemetry,
} from '@/simulation/domain/simulation-telemetry';
import { SimulationConfig } from '@/simulation/lifecycle/domain/simulation-config';
import { SimulationState } from '@/simulation/lifecycle/domain/simulation-state';
import { SimulationConfigNotFoundError } from '@/simulation/lifecycle/simulation-lifecycle.error';
import { SimulationLifecycleService } from '@/simulation/lifecycle/simulation-lifecycle.service';
import {
  SimulationLogFilters,
  SimulationLogEntry,
} from '@/simulation/logging/simulation-log.service';
import { SimulationLogService } from '@/simulation/logging/simulation-log.service';
import { IterationRunResult } from '@/simulation/scheduler/simulation-runner';
import {
  RunCustomActionInput as SchedulerRunCustomActionInput,
  SimulationScheduler,
} from '@/simulation/scheduler/simulation-scheduler';
import { WorldService, WorldView } from '@/world/world.service';

export type ListSimulationLogsInput = {
  slug: string;
  filters: SimulationLogFilters;
  page: number;
  limit: number;
};

/** A manual-run request resolved against a world slug instead of a worldId. */
export type RunCustomActionInput = Omit<
  SchedulerRunCustomActionInput,
  'worldSlug'
> & { slug: string };

/** Orchestrates admin simulation controls through persisted state and scheduler. */
@Injectable()
export class SimulationAdminService {
  constructor(
    private readonly worldService: WorldService,
    private readonly lifecycleService: SimulationLifecycleService,
    private readonly scheduler: SimulationScheduler,
    private readonly logService: SimulationLogService,
  ) {}

  async getConfig(slug: string): Promise<SimulationConfig> {
    return (await this.requireConfig(slug)).config;
  }

  async updateState(
    slug: string,
    state: SimulationState,
  ): Promise<SimulationConfig> {
    const world = await this.requireWorld(slug);
    return this.lifecycleService.transitionTo(world.id, state);
  }

  async updateSpeed(
    slug: string,
    speedMultiplier: number,
  ): Promise<SimulationConfig> {
    const world = await this.requireWorld(slug);
    return this.lifecycleService.updateSpeed(world.id, speedMultiplier);
  }

  runOneAction(slug: string): Promise<IterationRunResult> {
    return this.scheduler.runOneAction(slug);
  }

  runCustomAction(input: RunCustomActionInput): Promise<IterationRunResult> {
    return this.scheduler.runCustomAction({
      worldSlug: input.slug,
      characterId: input.characterId,
      actionType: input.actionType,
    });
  }

  async listLogs(
    input: ListSimulationLogsInput,
  ): Promise<Paginated<SimulationLogEntry>> {
    const world = await this.requireWorld(input.slug);
    return this.logService.list({
      worldId: world.id,
      filters: input.filters,
      page: input.page,
      limit: input.limit,
    });
  }

  async getTelemetry(slug: string): Promise<SimulationTelemetry> {
    const world = await this.requireWorld(slug);
    const telemetry = await this.logService.getTelemetry(world.id);
    return telemetry ?? emptySimulationTelemetry(world.id);
  }
  async getHealth(slug: string): Promise<SimulationHealth> {
    const { world, config } = await this.requireConfig(slug);

    const [observedScheduler, storedTelemetry] = await Promise.all([
      this.scheduler.getObservability(world.id),
      this.logService.getTelemetry(world.id),
    ]);
    const scheduler =
      config.state === 'RUNNING'
        ? observedScheduler
        : {
            ...observedScheduler,
            pending: false,
            workExpected: false,
            nextTurnAt: null,
          };
    const telemetry = storedTelemetry ?? emptySimulationTelemetry(world.id);
    const decision = deriveSimulationHealth({
      config,
      scheduler,
      telemetry,
    });
    const {
      lastSuccessAt,
      lastFailureAt,
      lastProviderSuccessAt,
      lastProviderFailureAt,
    } = normalizeProviderExecutionTimestamps(telemetry);

    return {
      lifecycleState: config.state,
      health: {
        status: decision.status,
        reason: decision.reason,
      },
      scheduler,
      execution: { lastSuccessAt, lastFailureAt },
      provider: {
        status: decision.providerStatus,
        lastSuccessAt: lastProviderSuccessAt,
        lastFailureAt: lastProviderFailureAt,
      },
      telemetry,
    };
  }

  private async requireConfig(slug: string): Promise<{
    world: WorldView;
    config: SimulationConfig;
  }> {
    const world = await this.requireWorld(slug);
    const config = await this.lifecycleService.getByWorldId(world.id);
    if (!config) {
      throw new SimulationConfigNotFoundError(world.id);
    }
    return { world, config };
  }

  private async requireWorld(slug: string): Promise<WorldView> {
    const world = await this.worldService.getBySlug(slug, true);
    if (!world) {
      throw new SimulationActionError(
        'WORLD_NOT_FOUND',
        `World "${slug}" was not found`,
      );
    }
    return world;
  }
}
