import type { SimulationRuntimeSignals } from '@/simulation/scheduler/simulation-runtime-signals';

export type SimulationRuntimeStateRecord = SimulationRuntimeSignals & {
  worldId: string;
  lastRetryAt: Date | null;
};

export type SimulationRuntimeStateUpdate = Partial<
  Omit<SimulationRuntimeStateRecord, 'worldId'>
>;

export abstract class SimulationRuntimeStateRepository {
  abstract findByWorldId(
    worldId: string,
  ): Promise<SimulationRuntimeStateRecord | null>;

  abstract update(
    worldId: string,
    input: SimulationRuntimeStateUpdate,
  ): Promise<void>;

  abstract recordDeadLetter(
    worldId: string,
    occurredAt: Date,
    reason: string,
  ): Promise<void>;
  abstract recordRetry(worldId: string): Promise<void>;
}
