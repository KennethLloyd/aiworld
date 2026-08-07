import { listPostsResponseSchema } from '@aiworld/shared/schemas/post-response.schema';
import { listPostsQuerySchema } from '@aiworld/shared/schemas/post.schema';
import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

export function registerPostsOpenApi(registry: OpenAPIRegistry): void {
  const ListPostsResponse = listPostsResponseSchema.meta({
    id: 'ListPostsResponse',
  });

  registry.registerPath({
    method: 'get',
    path: '/worlds/{slug}/posts',
    tags: ['posts'],
    summary: 'List the feed posts of a World',
    request: {
      params: z.object({ slug: z.string() }),
      query: listPostsQuerySchema,
    },
    responses: {
      200: {
        description:
          'Paginated feed of World posts with aggregated vote scores.',
        content: {
          'application/json': {
            schema: ListPostsResponse,
          },
        },
      },
      400: {
        description: 'The query parameters failed validation.',
      },
      404: {
        description: 'No active world exists with the given slug.',
      },
    },
  });
}
