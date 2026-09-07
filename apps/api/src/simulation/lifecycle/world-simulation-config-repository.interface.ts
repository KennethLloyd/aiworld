import { SimulationState } from '@/simulation/lifecycle/domain/simulation-state';
import { WorldSimulationConfigRecord } from '@/simulation/lifecycle/domain/world-simulation-config-record';

export abstract class WorldSimulationConfigRepository {
  abstract findByWorldId(
    worldId: string,
  ): Promise<WorldSimulationConfigRecord | null>;
  /** List persisted configurations in a lifecycle state. */
  abstract findAllByState(
    state: SimulationState,
  ): Promise<WorldSimulationConfigRecord[]>;
  abstract setState(
    worldId: string,
    state: SimulationState,
  ): Promise<WorldSimulationConfigRecord>;
  /** Persist a validated speed multiplier. */
  abstract updateSpeedMultiplier(
    worldId: string,
    speedMultiplier: number,
  ): Promise<WorldSimulationConfigRecord>;
}
