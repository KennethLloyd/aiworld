import {
  simulationHealthResponseSchema,
  type SimulationHealthResponse,
} from '@aiworld/shared/schemas/simulation-health.schema';
import {
  listSimulationLogsResponseSchema,
  type ListSimulationLogsQuery,
  type ListSimulationLogsResponse,
} from '@aiworld/shared/schemas/simulation-log.schema';
import {
  runCustomActionSchema,
  simulationRunResultResponseSchema,
  type RunCustomAction,
  type SimulationRunResultResponse,
} from '@aiworld/shared/schemas/simulation-run.schema';
import {
  simulationConfigResponseSchema,
  updateSimulationSpeedSchema,
  updateSimulationStateSchema,
  type SimulationConfigResponse,
  type UpdateSimulationSpeed,
  type UpdateSimulationState,
} from '@aiworld/shared/schemas/simulation-state.schema';
import {
  simulationTelemetryResponseSchema,
  type SimulationTelemetryResponse,
} from '@aiworld/shared/schemas/simulation-telemetry.schema';

import type { HttpClient } from '@/core/api/http-client';

import { adminEndpoints } from './admin-endpoints';
import type { AdminGateway } from './admin-gateway';

/** HTTP adapter for the ADMIN control-room port. Every response is validated
 * before it enters a TanStack Query cache or a component. */
export class HttpAdminGateway implements AdminGateway {
  constructor(private readonly http: HttpClient) {}

  async getSimulation(slug: string): Promise<SimulationConfigResponse> {
    const raw = await this.http.get<unknown>(
      adminEndpoints.simulation.config(slug),
    );
    return simulationConfigResponseSchema.parse(raw);
  }

  async updateSimulationState(
    slug: string,
    input: UpdateSimulationState,
  ): Promise<SimulationConfigResponse> {
    const body = updateSimulationStateSchema.parse(input);
    const raw = await this.http.patch<unknown>(
      adminEndpoints.simulation.state(slug),
      body,
    );
    return simulationConfigResponseSchema.parse(raw);
  }

  async updateSimulationSpeed(
    slug: string,
    input: UpdateSimulationSpeed,
  ): Promise<SimulationConfigResponse> {
    const body = updateSimulationSpeedSchema.parse(input);
    const raw = await this.http.patch<unknown>(
      adminEndpoints.simulation.speed(slug),
      body,
    );
    return simulationConfigResponseSchema.parse(raw);
  }

  async runOneAction(slug: string): Promise<SimulationRunResultResponse> {
    const raw = await this.http.post<unknown>(
      adminEndpoints.simulation.runOneAction(slug),
    );
    return simulationRunResultResponseSchema.parse(raw);
  }

  async runCustomAction(
    slug: string,
    input: RunCustomAction,
  ): Promise<SimulationRunResultResponse> {
    const body = runCustomActionSchema.parse(input);
    const raw = await this.http.post<unknown>(
      adminEndpoints.simulation.customAction(slug),
      body,
    );
    return simulationRunResultResponseSchema.parse(raw);
  }

  async getSimulationTelemetry(
    slug: string,
  ): Promise<SimulationTelemetryResponse> {
    const raw = await this.http.get<unknown>(
      adminEndpoints.simulation.telemetry(slug),
    );
    return simulationTelemetryResponseSchema.parse(raw);
  }
  async getSimulationHealth(slug: string): Promise<SimulationHealthResponse> {
    const raw = await this.http.get<unknown>(
      adminEndpoints.simulation.health(slug),
    );
    return simulationHealthResponseSchema.parse(raw);
  }

  async listSimulationLogs(
    slug: string,
    query: ListSimulationLogsQuery,
  ): Promise<ListSimulationLogsResponse> {
    const raw = await this.http.get<unknown>(
      adminEndpoints.simulation.logs(slug, query),
    );
    return listSimulationLogsResponseSchema.parse(raw);
  }
}
