import type { WorldSimulationConfig } from '@/generated/prisma/client';
import { SimulationState } from '@/simulation/lifecycle/domain/simulation-state';

export type ActionWeights = {
  POST: number;
  VOTE: number;
  COMMENT: number;
};

export type SimulationConfig = Omit<
  WorldSimulationConfig,
  'state' | 'actionWeights'
> & {
  state: SimulationState;
  actionWeights: ActionWeights;
};
