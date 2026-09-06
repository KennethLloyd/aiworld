import { deriveScheduledDelayMs } from '@aiworld/shared/schemas/simulation-command.schema';
import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';

import { SimulationLifecycleService } from '@/simulation/lifecycle/simulation-lifecycle.service';
import { SimulationCastingRepository } from '@/simulation/scheduler/simulation-casting-repository.interface';
import { SimulationIterationPicker } from '@/simulation/scheduler/simulation-iteration-picker';
import { SimulationRandomSource } from '@/simulation/scheduler/simulation-random-source';
import { SimulationRuntimeStateRepository } from '@/simulation/scheduler/simulation-runtime-state-repository.interface';
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
  /** Worlds whose current Tick is being processed. Reconciliation must not
   * add work while one of these Ticks is still active. */
  private readonly activeTicks = new Set<string>();
  private readonly ensureInFlight = new Map<string, Promise<void>>();

  constructor(
    lifecycleService: SimulationLifecycleService,
    worldRepository: WorldRepository,
    picker: SimulationIterationPicker,
    castingRepository: SimulationCastingRepository,
    tickRunner: SimulationTickRunner,
    private readonly randomSource: SimulationRandomSource,
    @Inject(SCHEDULER_CONFIG)
    private readonly schedulerConfig: SchedulerConfig,
    runtimeStateRepository: SimulationRuntimeStateRepository,
  ) {
    super(
      lifecycleService,
      worldRepository,
      picker,
      castingRepository,
      tickRunner,
      runtimeStateRepository,
    );
  }

  async start(worldId: string): Promise<void> {
    await this.ensureScheduled(worldId);
  }

  async ensureScheduled(worldId: string): Promise<void> {
    if (this.activeTicks.has(worldId)) {
      return;
    }

    const inFlight = this.ensureInFlight.get(worldId);
    if (inFlight !== undefined) {
      await inFlight;
      return;
    }

    const reconciliation = this.scheduleNextTick(worldId).finally(() => {
      if (this.ensureInFlight.get(worldId) === reconciliation) {
        this.ensureInFlight.delete(worldId);
      }
    });
    this.ensureInFlight.set(worldId, reconciliation);
    await reconciliation;
    await this.markSchedulerStartSucceeded(worldId);
  }

  async stop(worldId: string): Promise<void> {
    const handle = this.scheduledTicks.get(worldId);
    if (handle) {
      clearTimeout(handle);
      this.scheduledTicks.delete(worldId);
    }
    await this.markStopped(worldId);
  }

  async getObservability(
    worldId: string,
  ): Promise<SimulationSchedulerObservabilityRecord> {
    return this.getRuntimeObservability(worldId, true);
  }

  onModuleDestroy(): void {
    for (const handle of this.scheduledTicks.values()) {
      clearTimeout(handle);
    }
    this.scheduledTicks.clear();
    this.ensureInFlight.clear();
  }

  private async scheduleNextTick(
    worldId: string,
    allowActive = false,
  ): Promise<void> {
    if (!allowActive && this.activeTicks.has(worldId)) {
      return;
    }

    const existing = this.scheduledTicks.get(worldId);
    const config = await this.lifecycleService.getByWorldId(worldId);
    if (!config || config.state !== 'RUNNING') {
      this.clearScheduledTick(worldId, existing);
      await this.markStopped(worldId);
      return;
    }

    const world = await this.worldRepository.findById(worldId);
    if (!world?.isActive) {
      this.clearScheduledTick(worldId, existing);
      await this.markStopped(worldId);
      return;
    }

    const actors = await this.castingRepository.findActiveActors(worldId);
    if (actors.length === 0) {
      this.clearScheduledTick(worldId, existing);
      await this.markBlockedByNoActiveResidents(worldId);
      return;
    }

    if (!allowActive && existing !== undefined) {
      return;
    }

    this.clearScheduledTick(worldId, existing);
    await this.markStopped(worldId);

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
    await this.markScheduled(worldId, new Date(Date.now() + delay));
  }

  private clearScheduledTick(
    worldId: string,
    handle: NodeJS.Timeout | undefined,
  ): void {
    if (handle !== undefined) {
      clearTimeout(handle);
      this.scheduledTicks.delete(worldId);
    }
  }

  private async handleTick(worldId: string): Promise<void> {
    this.scheduledTicks.delete(worldId);
    this.activeTicks.add(worldId);
    await this.markTickStarted(worldId);

    try {
      const composed = await this.composeScheduledCommand(worldId);
      if (!composed) {
        await this.markStopped(worldId);
        return; // not RUNNING anymore, or the World cannot act — cadence stops
      }
      if ('blockedReason' in composed) {
        await this.markBlockedByNoActiveResidents(worldId);
        return;
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
          await this.markRetry(worldId);
          await this.sleep(this.backoffDelay(attempt));
          attempt += 1;
          continue;
        }
        break;
      }
      // Action outcomes are completed Iteration results, not scheduler faults,
      // so completion-to-start scheduling keeps the cadence alive after either
      // a permanent failure or an exhausted transient retry sequence. A World
      // that left RUNNING mid-tick (PAUSED, HALTED, or a stop during flight) is
      // not restarted.
      await this.scheduleNextTick(worldId, true);
    } finally {
      await this.markTickAttemptCompleted(worldId);
      await this.markTickSettled(worldId);
      this.activeTicks.delete(worldId);
    }
  }

  private backoffDelay(attempt: number): number {
    return this.schedulerConfig.retryBaseDelayMs * Math.pow(2, attempt - 1);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
