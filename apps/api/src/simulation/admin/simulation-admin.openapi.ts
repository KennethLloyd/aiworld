import {
  listSimulationLogsQuerySchema,
  listSimulationLogsResponseSchema,
} from '@aiworld/shared/schemas/simulation-log.schema';
import {
  runCustomActionSchema,
  simulationRunResultResponseSchema,
} from '@aiworld/shared/schemas/simulation-run.schema';
import {
  simulationConfigResponseSchema,
  updateSimulationSpeedSchema,
  updateSimulationStateSchema,
} from '@aiworld/shared/schemas/simulation-state.schema';
import { simulationTelemetryResponseSchema } from '@aiworld/shared/schemas/simulation-telemetry.schema';
import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

export function registerSimulationAdminOpenApi(
  registry: OpenAPIRegistry,
): void {
  const SimulationConfigResponse = simulationConfigResponseSchema.meta({
    id: 'SimulationConfigResponse',
  });
  const SimulationTelemetryResponse = simulationTelemetryResponseSchema.meta({
    id: 'SimulationTelemetryResponse',
  });
  const slugParam = z.string();

  const protectedOperation = [{ betterAuthSession: [] }];

  const simulationTags = ['simulation'];

  const adminResponses = {
    401: { description: 'Authentication is required.' },
    403: { description: 'The authenticated user is not an ADMIN.' },
    404: { description: 'No world exists with the given slug.' },
  } as const;

  registry.registerPath({
    method: 'get',
    path: '/worlds/{slug}/simulation',
    tags: simulationTags,
    summary: 'Read simulation configuration and lifecycle state',
    security: protectedOperation,
    request: { params: z.object({ slug: slugParam }) },
    responses: {
      200: {
        description: 'The world simulation configuration.',
        content: {
          'application/json': { schema: SimulationConfigResponse },
        },
      },
      ...adminResponses,
    },
  });

  registry.registerPath({
    method: 'patch',
    path: '/worlds/{slug}/simulation/state',
    tags: simulationTags,
    summary: 'Change the simulation lifecycle state',
    security: protectedOperation,
    request: {
      params: z.object({ slug: slugParam }),
      body: {
        description: 'The target lifecycle state.',
        content: {
          'application/json': { schema: updateSimulationStateSchema },
        },
      },
    },
    responses: {
      200: {
        description: 'The updated simulation configuration.',
        content: {
          'application/json': { schema: SimulationConfigResponse },
        },
      },
      400: { description: 'The request body failed validation.' },
      409: {
        description:
          'The transition is invalid for the current state or the world is HALTED.',
      },
      ...adminResponses,
    },
  });

  registry.registerPath({
    method: 'patch',
    path: '/worlds/{slug}/simulation/speed',
    tags: simulationTags,
    summary: 'Change the simulation speed multiplier',
    security: protectedOperation,
    request: {
      params: z.object({ slug: slugParam }),
      body: {
        description: 'The speed multiplier (0.1-100).',
        content: {
          'application/json': { schema: updateSimulationSpeedSchema },
        },
      },
    },
    responses: {
      200: {
        description: 'The updated simulation configuration.',
        content: {
          'application/json': { schema: SimulationConfigResponse },
        },
      },
      400: { description: 'The request body failed validation.' },
      ...adminResponses,
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/worlds/{slug}/simulation/run-one-action',
    tags: simulationTags,
    summary: 'Run one scheduler iteration by hand',
    security: protectedOperation,
    request: { params: z.object({ slug: slugParam }) },
    responses: {
      200: {
        description: 'The completed iteration and its logged outcome.',
        content: {
          'application/json': {
            schema: simulationRunResultResponseSchema,
          },
        },
      },
      409: {
        description: 'The world is HALTED and rejects manual work.',
      },
      ...adminResponses,
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/worlds/{slug}/simulation/custom-action',
    tags: simulationTags,
    summary: 'Compose and run one manual iteration',
    security: protectedOperation,
    request: {
      params: z.object({ slug: slugParam }),
      body: {
        description:
          'A specific character or Any Resident, and an action forced to POST/VOTE/COMMENT or Automatic.',
        content: {
          'application/json': { schema: runCustomActionSchema },
        },
      },
    },
    responses: {
      200: {
        description: 'The completed iteration and its logged outcome.',
        content: {
          'application/json': {
            schema: simulationRunResultResponseSchema,
          },
        },
      },
      400: { description: 'The request body failed validation.' },
      409: {
        description: 'The world is HALTED and rejects manual work.',
      },
      ...adminResponses,
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/worlds/{slug}/simulation/telemetry',
    tags: simulationTags,
    summary: 'Read simulation telemetry aggregates',
    security: protectedOperation,
    request: { params: z.object({ slug: slugParam }) },
    responses: {
      200: {
        description: 'Aggregate telemetry with no provider secrets.',
        content: {
          'application/json': { schema: SimulationTelemetryResponse },
        },
      },
      ...adminResponses,
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/worlds/{slug}/simulation/logs',
    tags: simulationTags,
    summary: 'Read filtered simulation logs',
    security: protectedOperation,
    request: {
      params: z.object({ slug: slugParam }),
      query: listSimulationLogsQuerySchema,
    },
    responses: {
      200: {
        description:
          'Paginated logs filtered by character, action, status, and execution source.',
        content: {
          'application/json': {
            schema: listSimulationLogsResponseSchema,
          },
        },
      },
      400: { description: 'The query parameters failed validation.' },
      ...adminResponses,
    },
  });
}
