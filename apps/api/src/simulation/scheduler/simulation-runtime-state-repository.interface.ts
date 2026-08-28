export type SimulationRuntimeStateRecord = {
  worldId: string;
  pending: boolean;
  workExpected: boolean;
  nextTickAt: Date | null;
  lastTickStartedAt: Date | null;
  lastTickCompletedAt: Date | null;
  retrying: boolean;
  recentRetryCount: number;
  lastRetryAt: Date | null;
  bootResumeFailure: {
    occurredAt: Date;
    reason: string;
  } | null;
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

  abstract recordRetry(worldId: string): Promise<void>;
}
