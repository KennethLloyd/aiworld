import { SimulationState } from '@/simulation/lifecycle/domain/simulation-state';

export type ActionWeights = {
  POST: number;
  VOTE: number;
  COMMENT: number;
};

/** One persisted WorldSimulationConfig row as the database returns it. */
export interface WorldSimulationConfigRecord {
  id: string;
  worldId: string;
  state: SimulationState;
  speedMultiplier: number;
  intervalMs: number;
  jitterMs: number;
  actionWeights: ActionWeights;
  createdAt: Date;
  updatedAt: Date;
}
