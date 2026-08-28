import { deriveScheduledDelayMs } from '@aiworld/shared/schemas/simulation-command.schema';
import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';

import { SimulationLifecycleService } from '@/simulation/lifecycle/simulation-lifecycle.service';
import { SimulationCastingRepository } from '@/simulation/scheduler/simulation-casting-repository.interface';
import { SimulationIterationPicker } from '@/simulation/scheduler/simulation-iteration-picker';
import { SimulationRandomSource } from '@/simulation/scheduler/simulation-random-source';
import type { SchedulerConfig } from '@/simulation/scheduler/simulation-scheduler-config';
import { SCHEDULER_CONFIG } from '@/simulation/scheduler/simulation-scheduler-config';
import { SimulationSchedulerBase } from '@/simulation/scheduler/simulation-scheduler.base';
import type { SimulationSchedulerObservabilityRecord } from '@/simulation/scheduler/simulation-scheduler.port';
import {
  ScheduledTickRunResult,
  SimulationTickRunner,
} from '@/simulation/scheduler/simulation-tick-runner';
import { WorldRepository } from '@/world/repositories/world-repository.interface';

/** The test/offline adapter: scheduled ticks run on chained `setTimeout`
 * handles with the same completion-to-start cadence as the BullMQ adapter
 * (the next delay is measured from the previous tick's completion, so ticks
 * never overlap). Retries follow the same exponential policy as BullMQ:
 * transient failures retry up to `maxAttempts`, permanent failures do not
 * retry. No Redis required. */
@Injectable()
export class InProcessSchedulerAdapter
  extends SimulationSchedulerBase
  implements OnModuleDestroy
{
  /** One pending delayed tick handle per World; replaced on every schedule. */
  private readonly scheduledTicks = new Map<string, NodeJS.Timeout>();

  constructor(
    lifecycleService: SimulationLifecycleService,
    worldRepository: WorldRepository,
    picker: SimulationIterationPicker,
    castingRepository: SimulationCastingRepository,
    tickRunner: SimulationTickRunner,
    private readonly randomSource: SimulationRandomSource,
    @Inject(SCHEDULER_CONFIG)
    private readonly schedulerConfig: SchedulerConfig,
  ) {
    super(
      lifecycleService,
      worldRepository,
      picker,
      castingRepository,
      tickRunner,
    );
  }

  async start(worldId: string): Promise<void> {
    await this.scheduleNextTick(worldId);
    this.markSchedulerStartSucceeded(worldId);
  }

  async stop(worldId: string): Promise<void> {
    const handle = this.scheduledTicks.get(worldId);
    if (handle) {
      clearTimeout(handle);
      this.scheduledTicks.delete(worldId);
    }
    this.markStopped(worldId);
  }

  getObservability(
    worldId: string,
  ): Promise<SimulationSchedulerObservabilityRecord> {
    return Promise.resolve(this.getRuntimeObservability(worldId, true));
  }

  onModuleDestroy(): void {
    for (const handle of this.scheduledTicks.values()) {
      clearTimeout(handle);
    }
    this.scheduledTicks.clear();
  }

  private async scheduleNextTick(worldId: string): Promise<void> {
    const existing = this.scheduledTicks.get(worldId);
    if (existing) {
      clearTimeout(existing);
      this.scheduledTicks.delete(worldId);
    }
    this.markStopped(worldId);

    const config = await this.lifecycleService.getByWorldId(worldId);
    if (!config || config.state !== 'RUNNING') {
      return;
    }

    const world = await this.worldRepository.findById(worldId);
    if (!world?.isActive) {
      return;
    }

    const delay = deriveScheduledDelayMs({
      intervalMs: config.intervalMs,
      jitterMs: config.jitterMs,
      speedMultiplier: config.speedMultiplier,
      random: () => this.randomSource.next(),
    });

    const handle = setTimeout(() => {
      void this.handleTick(worldId).catch(() => {
        // A transient failure while composing (e.g. a database blip) must not
        // stop the World's cadence; the completion-to-start path reschedules.
        void this.scheduleNextTick(worldId);
      });
    }, delay);
    this.scheduledTicks.set(worldId, handle);
    this.markScheduled(worldId, new Date(Date.now() + delay), world.slug);
  }

  private async handleTick(worldId: string): Promise<void> {
    this.scheduledTicks.delete(worldId);
    this.markTickStarted(worldId);

    try {
      const composed = await this.composeScheduledCommand(worldId);
      if (!composed) {
        return; // not RUNNING anymore, or the World cannot act — cadence stops
      }

      let result: ScheduledTickRunResult;
      let attempt = 1;
      for (;;) {
        result = await this.tickRunner.runScheduledTick(composed.command);
        if (
          result.status === 'failed' &&
          result.failure.retryable &&
          attempt < this.schedulerConfig.maxAttempts
        ) {
          this.markRetry(worldId);
          await this.sleep(this.backoffDelay(attempt));
          attempt += 1;
          continue;
        }
        break;
      }

      // Completion-to-start: schedule the next tick after this one finishes,
      // regardless of the outcome. A World that left RUNNING mid-tick (PAUSED,
      // HALTED, or a stop during flight) is not restarted.
      await this.scheduleNextTick(worldId);
    } finally {
      this.markTickAttemptCompleted(worldId);
      this.markTickSettled(worldId);
    }
  }

  private backoffDelay(attempt: number): number {
    return this.schedulerConfig.retryBaseDelayMs * Math.pow(2, attempt - 1);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
