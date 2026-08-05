import {
  listWorldsResponseSchema,
  worldResponseSchema,
} from '@aiworld/shared/schemas/world-response.schema';
import {
  createWorldSchema,
  listWorldsQuerySchema,
  updateWorldSchema,
} from '@aiworld/shared/schemas/world.schema';
import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

export function registerWorldOpenApi(registry: OpenAPIRegistry): void {
  const WorldResponse = worldResponseSchema.meta({ id: 'WorldResponse' });
  const ListWorldsResponse = listWorldsResponseSchema.meta({
    id: 'ListWorldsResponse',
  });

  const slugParam = z.string();

  const protectedOperation = [{ betterAuthSession: [] }];

  registry.registerPath({
    method: 'get',
    path: '/worlds',
    tags: ['worlds'],
    summary: 'List worlds',
    request: {
      query: listWorldsQuerySchema,
    },
    responses: {
      200: {
        description: 'Paginated list of worlds matching the query.',
        content: {
          'application/json': {
            schema: ListWorldsResponse,
          },
        },
      },
      400: {
        description: 'The query parameters failed validation.',
      },
    },
  });

  registry.registerPath({
    method: 'get',
    path: '/worlds/{slug}',
    tags: ['worlds'],
    summary: 'Get a world by slug',
    request: {
      params: z.object({ slug: slugParam }),
    },
    responses: {
      200: {
        description: 'The requested world.',
        content: {
          'application/json': {
            schema: WorldResponse,
          },
        },
      },
      404: {
        description: 'No world exists with the given slug.',
      },
    },
  });

  registry.registerPath({
    method: 'post',
    path: '/worlds',
    tags: ['worlds'],
    summary: 'Create a world',
    security: protectedOperation,
    request: {
      body: {
        description: 'The world to create.',
        content: {
          'application/json': {
            schema: createWorldSchema,
          },
        },
      },
    },
    responses: {
      201: {
        description: 'The created world.',
        content: {
          'application/json': {
            schema: WorldResponse,
          },
        },
      },
      400: {
        description: 'The request body failed validation.',
      },
      401: {
        description: 'Authentication is required.',
      },
      403: {
        description: 'The authenticated user is not an ADMIN.',
      },
    },
  });

  registry.registerPath({
    method: 'patch',
    path: '/worlds/{slug}',
    tags: ['worlds'],
    summary: 'Update a world',
    security: protectedOperation,
    request: {
      params: z.object({ slug: slugParam }),
      body: {
        description: 'The world fields to update.',
        content: {
          'application/json': {
            schema: updateWorldSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: 'The updated world.',
        content: {
          'application/json': {
            schema: WorldResponse,
          },
        },
      },
      400: {
        description: 'The request body failed validation.',
      },
      401: {
        description: 'Authentication is required.',
      },
      403: {
        description: 'The authenticated user is not an ADMIN.',
      },
      404: {
        description: 'No world exists with the given slug.',
      },
    },
  });

  registry.registerPath({
    method: 'delete',
    path: '/worlds/{slug}',
    tags: ['worlds'],
    summary: 'Delete a world',
    security: protectedOperation,
    request: {
      params: z.object({ slug: slugParam }),
    },
    responses: {
      204: {
        description: 'The world was deleted.',
      },
      401: {
        description: 'Authentication is required.',
      },
      403: {
        description: 'The authenticated user is not an ADMIN.',
      },
      404: {
        description: 'No world exists with the given slug.',
      },
    },
  });
}
