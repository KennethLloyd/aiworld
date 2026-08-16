import { SimulationState } from '@/simulation/lifecycle/domain/simulation-state';
import { WorldSimulationConfigRecord } from '@/simulation/lifecycle/domain/world-simulation-config-record';

export abstract class WorldSimulationConfigRepository {
  abstract findByWorldId(
    worldId: string,
  ): Promise<WorldSimulationConfigRecord | null>;
  /** All persisted configurations in the given lifecycle state (used by boot
   * resume to restart RUNNING worlds). */
  abstract findAllByState(
    state: SimulationState,
  ): Promise<WorldSimulationConfigRecord[]>;
  /** Atomically move a config from one persisted state to another. Throws if
   * the persisted state no longer matches `from` (concurrent change). */
  abstract transitionState(
    worldId: string,
    from: SimulationState,
    to: SimulationState,
  ): Promise<WorldSimulationConfigRecord>;
  /** Persist a new speed multiplier. Throws when no config exists for the
   * world. The multiplier is validated at the shared contract boundary before
   * it reaches here. */
  abstract updateSpeedMultiplier(
    worldId: string,
    speedMultiplier: number,
  ): Promise<WorldSimulationConfigRecord>;
}
