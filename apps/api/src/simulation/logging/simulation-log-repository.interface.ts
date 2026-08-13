import { Paginated } from '@aiworld/shared/schemas/pagination.schema';

import { SimulationActionType } from '@/simulation/actions/simulation-action-type';
import {
  SimulationExecutionSource,
  SimulationLogStatus,
} from '@/simulation/domain/simulation-log';
import { SimulationTelemetryRecord } from '@/simulation/domain/simulation-telemetry';
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

export type SimulationLogFilters = {
  characterId?: string;
  action?: SimulationActionType;
  status?: SimulationLogStatus;
  executionSource?: SimulationExecutionSource;
};

export abstract class SimulationLogRepository {
  abstract create(
    input: SimulationLogCreateInput,
  ): Promise<SimulationLogRecord>;
  /** Paginated log rows for a World, newest first, filtered by character,
   * action, status, and execution source. */
  abstract findMany(input: {
    worldId: string;
    filters: SimulationLogFilters;
    page: number;
    limit: number;
  }): Promise<Paginated<SimulationLogRecord>>;
  /** Operator-facing aggregates for a World, or null when it has no logs. */
  abstract getTelemetry(
    worldId: string,
  ): Promise<SimulationTelemetryRecord | null>;
}
