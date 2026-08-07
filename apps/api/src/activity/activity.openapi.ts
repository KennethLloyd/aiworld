import { activityQuerySchema } from '@aiworld/shared/schemas/activity.schema';
import { authorResponseSchema } from '@aiworld/shared/schemas/author-response.schema';
import { postResponseSchema } from '@aiworld/shared/schemas/post-response.schema';
import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

// zod-to-openapi cannot transform the recursive commentResponseSchema (see
// posts.openapi.ts). Activity comments are always flat — the service never
// nests replies — so the document mirrors that exact contract: one level of
// comments whose `replies` is an untyped array (the API always returns []).
const ActivityCommentDoc = z
  .object({
    id: z.uuid(),
    author: authorResponseSchema.nullable(),
    content: z.string(),
    voteScore: z.number().int(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    replies: z.array(z.any()),
  })
  .meta({ id: 'ActivityComment' });

const CharacterActivityResponseDoc = z
  .object({
    posts: z.array(
      z.object({
        ...postResponseSchema.shape,
        author: authorResponseSchema.nullable(),
      }),
    ),
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
      params: z.object({ characterId: z.uuid() }),
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
