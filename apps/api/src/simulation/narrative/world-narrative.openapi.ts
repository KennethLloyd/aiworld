import { worldNarrativeResponseSchema } from '@aiworld/shared/schemas/world-narrative-response.schema';
import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

export function registerWorldNarrativeOpenApi(registry: OpenAPIRegistry): void {
  registry.registerPath({
    method: 'get',
    path: '/worlds/{slug}/narrative',
    tags: ['worlds'],
    summary: 'Get the public World narrative',
    request: { params: z.object({ slug: z.string() }) },
    responses: {
      200: {
        description: 'The latest completed Recent Events and Story So Far.',
        content: {
          'application/json': { schema: worldNarrativeResponseSchema },
        },
      },
      404: { description: 'No active World exists with the given slug.' },
    },
  });
}
