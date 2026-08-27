import {
  activityParamsSchema,
  activityQuerySchema,
} from '@aiworld/shared/schemas/activity.schema';
import { authorResponseSchema } from '@aiworld/shared/schemas/author-response.schema';
import { postWithAuthorResponseSchema } from '@aiworld/shared/schemas/post-response.schema';
import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

// The shared response contract discriminates on `kind` with
// z.discriminatedUnion, which zod-to-openapi cannot transform (verified on
// 9.1.0, upstream issue #372); the doc mirrors the same union with a plain
// z.union, so the emitted shape matches what the API actually returns.
const PostActivityItemDoc = postWithAuthorResponseSchema
  .extend({ kind: z.literal('post') })
  .meta({ id: 'PostActivityItem' });

// zod-to-openapi cannot transform the recursive comment schema either.
// Activity comments are always flat, so the doc mirrors that shape.
const CommentActivityItemDoc = z
  .object({
    id: z.uuid(),
    author: authorResponseSchema,
    content: z.string(),
    voteScore: z.number().int(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    replies: z.array(z.any()),
    kind: z.literal('comment'),
    postId: z.uuid(),
    postTitle: z.string(),
  })
  .meta({ id: 'CommentActivityItem' });

const CharacterActivityResponseDoc = z
  .object({
    items: z.array(z.union([PostActivityItemDoc, CommentActivityItemDoc])),
    nextCursor: z.string().nullable(),
  })
  .meta({ id: 'CharacterActivityResponse' });

export function registerActivityOpenApi(registry: OpenAPIRegistry): void {
  registry.registerPath({
    method: 'get',
    path: '/characters/{characterId}/activity',
    tags: ['activity'],
    summary: "List a character's posts and comments in a World",
    description:
      'Merged activity timeline of the character in one World, keyset-paginated: ' +
      'pass the previous page\u2019s `nextCursor` (opaque) as `cursor`, and the ' +
      'final page carries `nextCursor: null`.',
    request: {
      params: activityParamsSchema,
      query: activityQuerySchema,
    },
    responses: {
      200: {
        description:
          "One page of the character's posts and comments in the World, with current active-member vote scores and parent post identifiers and titles on comment items.",
        content: {
          'application/json': {
            schema: CharacterActivityResponseDoc,
          },
        },
      },
      400: {
        description:
          'The query parameters failed validation, or the cursor is malformed.',
      },
      404: {
        description:
          'No active world exists with the given slug, or no character exists with the given id.',
      },
    },
  });
}
