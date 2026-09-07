import { SimulationActionType } from '@/simulation/actions/simulation-action-type';
import { IterationRunResult } from '@/simulation/scheduler/simulation-runner';
import type { SimulationRuntimeSignals } from '@/simulation/scheduler/simulation-runtime-signals';

export type RunCustomActionInput = {
  worldSlug: string;
  characterId?: string;
  actionType?: SimulationActionType;
};

export type SimulationSchedulerObservabilityRecord =
  SimulationRuntimeSignals & {
    available: boolean;
  };

/** Scheduler port for scheduled and manual simulation work. */
export abstract class SimulationScheduler {
  /** Ensure a RUNNING World has at most one pending or active scheduled Tick. */
  abstract ensureScheduled(worldId: string): Promise<void>;
  /** Reconcile scheduled ticks for a persisted RUNNING World. */
  abstract start(worldId: string): Promise<void>;
  /** Remove pending scheduled work; an in-flight tick may finish. */
  abstract stop(worldId: string): Promise<void>;
  /** Run the scheduler's task once by hand: identical random pick and roll,
   * no overrides, awaits the result. */
  abstract runOneAction(worldSlug: string): Promise<IterationRunResult>;
  /** Compose one manual iteration: a specific character or Any Character, an
   * action forced to POST/VOTE/COMMENT or Automatic. Awaits the result. */
  abstract runCustomAction(
    input: RunCustomActionInput,
  ): Promise<IterationRunResult>;
  /** Return application-level scheduler signals without exposing queue
   * implementation details or provider credentials. */
  abstract getObservability(
    worldId: string,
  ): Promise<SimulationSchedulerObservabilityRecord>;
  abstract recordBootResumeFailure(
    worldId: string,
    error: unknown,
  ): Promise<void>;
}
