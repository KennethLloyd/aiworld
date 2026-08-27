import { Paginated } from '@aiworld/shared/schemas/pagination.schema';
import { Injectable } from '@nestjs/common';

import { SimulationActionError } from '@/simulation/actions/simulation-action.error';
import {
  emptySimulationTelemetry,
  SimulationTelemetryRecord,
} from '@/simulation/domain/simulation-telemetry';
import { SimulationState } from '@/simulation/lifecycle/domain/simulation-state';
import { WorldSimulationConfigRecord } from '@/simulation/lifecycle/domain/world-simulation-config-record';
import { SimulationConfigNotFoundError } from '@/simulation/lifecycle/simulation-lifecycle.error';
import { SimulationLifecycleService } from '@/simulation/lifecycle/simulation-lifecycle.service';
import { SimulationLogRecord } from '@/simulation/logging/simulation-log-record';
import {
  SimulationLogFilters,
  SimulationLogRepository,
} from '@/simulation/logging/simulation-log-repository.interface';
import {
  RunCustomActionInput as SchedulerRunCustomActionInput,
  SimulationScheduler,
} from '@/simulation/scheduler/simulation-scheduler.port';
import { IterationRunResult } from '@/simulation/scheduler/simulation-tick-runner';
import { WorldRecord } from '@/world/domain/world-record';
import { WorldRepository } from '@/world/repositories/world-repository.interface';

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

/** Orchestrates the admin simulation controls. Controllers stay thin: every
 * operation here either reads/mutates persisted configuration or enqueues a
 * manual command through the scheduler — the admin API never calls an LLM
 * provider directly. Lifecycle gates (inactive Worlds and HALTED configs
 * reject work) are enforced by the state machine inside the lifecycle service
 * and tick runner. */
@Injectable()
export class SimulationAdminService {
  constructor(
    private readonly worldRepository: WorldRepository,
    private readonly lifecycleService: SimulationLifecycleService,
    private readonly scheduler: SimulationScheduler,
    private readonly logRepository: SimulationLogRepository,
  ) {}

  async getConfig(slug: string): Promise<WorldSimulationConfigRecord> {
    const world = await this.requireWorld(slug);
    const config = await this.lifecycleService.getByWorldId(world.id);
    if (!config) {
      throw new SimulationConfigNotFoundError(world.id);
    }
    return config;
  }

  async updateState(
    slug: string,
    state: SimulationState,
  ): Promise<WorldSimulationConfigRecord> {
    const world = await this.requireWorld(slug);
    return this.lifecycleService.transitionTo(world.id, state);
  }

  async updateSpeed(
    slug: string,
    speedMultiplier: number,
  ): Promise<WorldSimulationConfigRecord> {
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
  ): Promise<Paginated<SimulationLogRecord>> {
    const world = await this.requireWorld(input.slug);
    return this.logRepository.findMany({
      worldId: world.id,
      filters: input.filters,
      page: input.page,
      limit: input.limit,
    });
  }

  async getTelemetry(slug: string): Promise<SimulationTelemetryRecord> {
    const world = await this.requireWorld(slug);
    const telemetry = await this.logRepository.getTelemetry(world.id);
    return telemetry ?? emptySimulationTelemetry(world.id);
  }

  private async requireWorld(slug: string): Promise<WorldRecord> {
    const world = await this.worldRepository.findBySlug(slug);
    if (!world) {
      throw new SimulationActionError(
        'WORLD_NOT_FOUND',
        `World "${slug}" was not found`,
      );
    }
    return world;
  }
}
