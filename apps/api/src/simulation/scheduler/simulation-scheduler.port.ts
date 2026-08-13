import { SimulationActionType } from '@/simulation/actions/simulation-action-type';
import { IterationRunResult } from '@/simulation/scheduler/simulation-tick-runner';

export type RunCustomActionInput = {
  worldSlug: string;
  characterId?: string;
  actionType?: SimulationActionType;
};

/** The seam that drives simulation ticks. `start`/`stop` control scheduled
 * work for a World; `runOneAction` and `runCustomAction` compose and await a
 * single manual iteration. Lifecycle rules are enforced by the state machine,
 * never by an adapter, and every operation funnels through the tick runner. */
export abstract class SimulationScheduler {
  /** Begin scheduled ticks for a World (resumes a persisted RUNNING state on
   * boot; replaces any previously pending tick). No-op when already active. */
  abstract start(worldId: string): Promise<void>;
  /** Remove the single pending scheduled tick for a World. An in-flight tick
   * completes; the executor gate rejects any transition race window. */
  abstract stop(worldId: string): Promise<void>;
  /** Run the scheduler's task once by hand: identical random pick and roll,
   * no overrides, awaits the result. */
  abstract runOneAction(worldSlug: string): Promise<IterationRunResult>;
  /** Compose one manual iteration: a specific character or Any Resident, an
   * action forced to POST/VOTE/COMMENT or Automatic. Awaits the result. */
  abstract runCustomAction(
    input: RunCustomActionInput,
  ): Promise<IterationRunResult>;
}
