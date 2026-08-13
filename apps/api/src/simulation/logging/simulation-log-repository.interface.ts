import { SimulationActionType } from '@/simulation/actions/simulation-action-type';
import {
  SimulationExecutionSource,
  SimulationLogStatus,
} from '@/simulation/domain/simulation-log';
import { SimulationLogRecord } from '@/simulation/logging/simulation-log-record';

export type SimulationLogCreateInput = {
  worldId: string;
  characterId: string;
  action: SimulationActionType;
  targetId?: string | null;
  reasoning?: string | null;
  provider: string;
  model: string;
  latencyMs?: number | null;
  jobId?: string | null;
  executionSource: SimulationExecutionSource;
  tokensUsed?: number | null;
  costEstimate?: number | null;
  status: SimulationLogStatus;
  errorMessage?: string | null;
};

export abstract class SimulationLogRepository {
  abstract create(
    input: SimulationLogCreateInput,
  ): Promise<SimulationLogRecord>;
}
