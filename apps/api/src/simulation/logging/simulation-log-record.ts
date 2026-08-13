import { SimulationActionType } from '@/simulation/actions/simulation-action-type';
import {
  SimulationExecutionSource,
  SimulationLogStatus,
} from '@/simulation/domain/simulation-log';

/** One persisted SimulationLog row as the database returns it. */
export interface SimulationLogRecord {
  id: string;
  worldId: string;
  characterId: string;
  action: SimulationActionType;
  targetId: string | null;
  reasoning: string | null;
  provider: string;
  model: string;
  latencyMs: number | null;
  jobId: string | null;
  executionSource: SimulationExecutionSource;
  tokensUsed: number | null;
  costEstimate: number | null;
  status: SimulationLogStatus;
  errorMessage: string | null;
  executedAt: Date;
}
