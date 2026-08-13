import { deriveScheduledDelayMs } from '@aiworld/shared/schemas/simulation-command.schema';
import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';

import { SimulationActionError } from '@/simulation/actions/simulation-action.error';
import { WorldSimulationConfigRecord } from '@/simulation/lifecycle/domain/world-simulation-config-record';
import { SimulationLifecycleService } from '@/simulation/lifecycle/simulation-lifecycle.service';
import { SimulationIterationPicker } from '@/simulation/scheduler/simulation-iteration-picker';
import { SimulationRandomSource } from '@/simulation/scheduler/simulation-random-source';
import type { SchedulerConfig } from '@/simulation/scheduler/simulation-scheduler-config';
import { SCHEDULER_CONFIG } from '@/simulation/scheduler/simulation-scheduler-config';
import {
  RunCustomActionInput,
  SimulationScheduler,
} from '@/simulation/scheduler/simulation-scheduler.port';
import {
  IterationRunResult,
  ScheduledTickRunResult,
  SimulationTickRunner,
} from '@/simulation/scheduler/simulation-tick-runner';
import { WorldRecord } from '@/world/domain/world-record';
import { WorldRepository } from '@/world/repositories/world-repository.interface';

/** The test/offline adapter: scheduled ticks run on chained `setTimeout`
 * timers with the same completion-to-start cadence as the BullMQ adapter
 * (the next delay is measured from the previous tick's completion, so ticks
 * never overlap). Retries follow the same exponential policy as BullMQ:
 * transient failures retry up to `maxAttempts`, permanent failures do not
 * retry. No Redis required. */
@Injectable()
export class InProcessSchedulerAdapter
  extends SimulationScheduler
  implements OnModuleDestroy
{
  private readonly pending = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly lifecycleService: SimulationLifecycleService,
    private readonly worldRepository: WorldRepository,
    private readonly picker: SimulationIterationPicker,
    private readonly tickRunner: SimulationTickRunner,
    private readonly randomSource: SimulationRandomSource,
    @Inject(SCHEDULER_CONFIG)
    private readonly schedulerConfig: SchedulerConfig,
  ) {
    super();
  }

  async start(worldId: string): Promise<void> {
    const config = await this.requireConfig(worldId);
    if (config.state !== 'RUNNING') {
      return;
    }
    await this.scheduleNextTick(worldId);
  }

  async stop(worldId: string): Promise<void> {
    const timer = this.pending.get(worldId);
    if (timer) {
      clearTimeout(timer);
      this.pending.delete(worldId);
    }
  }

  async runOneAction(worldSlug: string): Promise<IterationRunResult> {
    return this.tickRunner.runManualIteration({
      worldSlug,
      executionSource: 'one-action',
    });
  }

  async runCustomAction(
    input: RunCustomActionInput,
  ): Promise<IterationRunResult> {
    return this.tickRunner.runManualIteration({
      worldSlug: input.worldSlug,
      characterId: input.characterId,
      actionType: input.actionType,
      executionSource: 'custom',
    });
  }

  onModuleDestroy(): void {
    for (const timer of this.pending.values()) {
      clearTimeout(timer);
    }
    this.pending.clear();
  }

  private async scheduleNextTick(worldId: string): Promise<void> {
    const config = await this.requireConfig(worldId);
    if (config.state !== 'RUNNING') {
      return;
    }

    const existing = this.pending.get(worldId);
    if (existing) {
      clearTimeout(existing);
    }

    const delay = deriveScheduledDelayMs({
      intervalMs: config.intervalMs,
      jitterMs: config.jitterMs,
      speedMultiplier: config.speedMultiplier,
      random: () => this.randomSource.next(),
    });

    const timer = setTimeout(() => {
      void this.handleTick(worldId).catch(() => {
        // A tick that fails to even be composed (e.g. the world was deleted)
        // must not stop the world's cadence silently; the next attempt is
        // scheduled by the completion-to-start path below.
        void this.scheduleNextTick(worldId);
      });
    }, delay);
    this.pending.set(worldId, timer);
  }

  private async handleTick(worldId: string): Promise<void> {
    this.pending.delete(worldId);

    const world = await this.requireWorld(worldId);
    const config = await this.requireConfig(worldId);
    if (config.state !== 'RUNNING') {
      return;
    }

    const { characterId } = await this.picker.pickCharacter(worldId);
    const actionType = this.picker.pickAction(config.actionWeights);

    let result: ScheduledTickRunResult;
    let attempt = 1;
    for (;;) {
      result = await this.tickRunner.runScheduledTick({
        worldSlug: world.slug,
        characterId,
        actionType,
        executionSource: 'scheduled',
      });
      if (
        result.status === 'failed' &&
        result.failure.retryable &&
        attempt < this.schedulerConfig.maxAttempts
      ) {
        await this.sleep(this.backoffDelay(attempt));
        attempt += 1;
        continue;
      }
      break;
    }

    // Completion-to-start: schedule the next tick after this one finishes,
    // regardless of the outcome. A world that left RUNNING mid-tick (PAUSED,
    // HALTED, or a stop during flight) is not restarted.
    await this.scheduleNextTick(worldId);
  }

  private backoffDelay(attempt: number): number {
    return this.schedulerConfig.retryBaseDelayMs * Math.pow(2, attempt - 1);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async requireWorld(worldId: string): Promise<WorldRecord> {
    const world = await this.worldRepository.findById(worldId);
    if (!world) {
      throw new SimulationActionError(
        'WORLD_NOT_FOUND',
        `World "${worldId}" was not found`,
      );
    }
    return world;
  }

  private async requireConfig(
    worldId: string,
  ): Promise<WorldSimulationConfigRecord> {
    const config = await this.lifecycleService.getByWorldId(worldId);
    if (!config) {
      throw new SimulationActionError(
        'WORLD_NOT_FOUND',
        `No simulation configuration for world "${worldId}"`,
      );
    }
    return config;
  }
}
