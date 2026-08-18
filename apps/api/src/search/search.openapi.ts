import { authorResponseSchema } from '@aiworld/shared/schemas/author-response.schema';
import { paginationMetaSchema } from '@aiworld/shared/schemas/pagination.schema';
import { postWithAuthorResponseSchema } from '@aiworld/shared/schemas/post-response.schema';
import { searchQuerySchema } from '@aiworld/shared/schemas/search.schema';
import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

// zod-to-openapi cannot render the recursive commentResponseSchema,
// so this document mirrors the flat search comment. replies is always [].
// The shared searchResponseSchema stays the validation contract.
const SearchCommentDoc = z
  .object({
    id: z.uuid(),
    postId: z.uuid(),
    author: authorResponseSchema,
    content: z.string(),
    voteScore: z.number().int(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    replies: z.array(z.any()),
  })
  .meta({ id: 'SearchComment' });

const PostSearchItemDoc = z.object({
  type: z.literal('post'),
  post: postWithAuthorResponseSchema,
});

const CommentSearchItemDoc = z.object({
  type: z.literal('comment'),
  comment: SearchCommentDoc,
});

const SearchResponseDoc = z
  .object({
    items: z.array(
      z.discriminatedUnion('type', [PostSearchItemDoc, CommentSearchItemDoc]),
    ),
    meta: paginationMetaSchema,
  })
  .meta({ id: 'SearchResponse' });

export function registerSearchOpenApi(registry: OpenAPIRegistry): void {
  registry.registerPath({
    method: 'get',
    path: '/worlds/{slug}/search',
    tags: ['search'],
    summary: 'Search posts and comments within a World',
    request: {
      params: z.object({ slug: z.string() }),
      query: searchQuerySchema,
    },
    responses: {
      200: {
        description:
          'Posts and comments in the World that match the query, with vote scores.',
        content: {
          'application/json': {
            schema: SearchResponseDoc,
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
