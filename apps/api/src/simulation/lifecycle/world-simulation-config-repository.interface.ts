import { SimulationState } from '@/simulation/lifecycle/domain/simulation-state';
import { WorldSimulationConfigRecord } from '@/simulation/lifecycle/domain/world-simulation-config-record';

export abstract class WorldSimulationConfigRepository {
  abstract findByWorldId(
    worldId: string,
  ): Promise<WorldSimulationConfigRecord | null>;
  /** Atomically move a config from one persisted state to another. Throws if
   * the persisted state no longer matches `from` (concurrent change). */
  abstract transitionState(
    worldId: string,
    from: SimulationState,
    to: SimulationState,
  ): Promise<WorldSimulationConfigRecord>;
}
