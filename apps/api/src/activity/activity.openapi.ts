import {
  activityParamsSchema,
  activityQuerySchema,
} from '@aiworld/shared/schemas/activity.schema';
import { authorResponseSchema } from '@aiworld/shared/schemas/author-response.schema';
import { postWithAuthorResponseSchema } from '@aiworld/shared/schemas/post-response.schema';
import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

// zod-to-openapi cannot transform the recursive comment schema.
// Activity comments are always flat, so the doc mirrors that shape.
const ActivityCommentDoc = z
  .object({
    id: z.uuid(),
    author: authorResponseSchema,
    content: z.string(),
    voteScore: z.number().int(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    replies: z.array(z.any()),
  })
  .meta({ id: 'ActivityComment' });

const CharacterActivityResponseDoc = z
  .object({
    posts: z.array(postWithAuthorResponseSchema),
    comments: z.array(ActivityCommentDoc),
  })
  .meta({ id: 'CharacterActivityResponse' });

export function registerActivityOpenApi(registry: OpenAPIRegistry): void {
  registry.registerPath({
    method: 'get',
    path: '/characters/{characterId}/activity',
    tags: ['activity'],
    summary: "List a character's posts and comments in a World",
    request: {
      params: activityParamsSchema,
      query: activityQuerySchema,
    },
    responses: {
      200: {
        description:
          "The character's posts and comments in the World, with aggregated vote scores.",
        content: {
          'application/json': {
            schema: CharacterActivityResponseDoc,
          },
        },
      },
      400: {
        description: 'The query parameters failed validation.',
      },
      404: {
        description:
          'No active world exists with the given slug, or no character exists with the given id.',
      },
    },
  });
}
