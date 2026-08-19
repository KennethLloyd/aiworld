import type {
  ListSimulationLogsQuery,
  ListSimulationLogsResponse,
} from '@aiworld/shared/schemas/simulation-log.schema';
import type {
  RunCustomAction,
  SimulationRunResultResponse,
} from '@aiworld/shared/schemas/simulation-run.schema';
import type {
  SimulationConfigResponse,
  UpdateSimulationSpeed,
  UpdateSimulationState,
} from '@aiworld/shared/schemas/simulation-state.schema';
import type { SimulationTelemetryResponse } from '@aiworld/shared/schemas/simulation-telemetry.schema';

export interface AdminGateway {
  getSimulation(slug: string): Promise<SimulationConfigResponse>;
  updateSimulationState(
    slug: string,
    input: UpdateSimulationState,
  ): Promise<SimulationConfigResponse>;
  updateSimulationSpeed(
    slug: string,
    input: UpdateSimulationSpeed,
  ): Promise<SimulationConfigResponse>;
  runOneAction(slug: string): Promise<SimulationRunResultResponse>;
  runCustomAction(
    slug: string,
    input: RunCustomAction,
  ): Promise<SimulationRunResultResponse>;
  getSimulationTelemetry(slug: string): Promise<SimulationTelemetryResponse>;
  listSimulationLogs(
    slug: string,
    query: ListSimulationLogsQuery,
  ): Promise<ListSimulationLogsResponse>;
}
