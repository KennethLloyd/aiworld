import { authorResponseSchema } from '@aiworld/shared/schemas/author-response.schema';
import {
  listPostsResponseSchema,
  postResponseSchema,
} from '@aiworld/shared/schemas/post-response.schema';
import {
  listPostsQuerySchema,
  postDetailParamsSchema,
} from '@aiworld/shared/schemas/post.schema';
import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

// zod-to-openapi cannot transform recursive schemas, verified against the
// latest release (9.1.0, 2026-07-19): its nullability probes run
// safeParse on every schema, and a circular schema overflows the error
// formatter during generation (upstream issue #372 remains open). The
// document therefore mirrors the read-side contract exactly as the API
// bounds it: the comment tree stops at three levels of nesting, and the
// leaf level declares `replies` with an untyped array (z.any, which the
// generator emits as an open items schema) because the API never returns
// replies there. The shared commentResponseSchema remains the validation
// contract.
const commentTreeFields = {
  id: z.uuid(),
  author: authorResponseSchema,
  content: z.string(),
  voteScore: z.number().int(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
};

const CommentLeafDoc = z.object({
  ...commentTreeFields,
  replies: z.array(z.any()),
});

const CommentReplyDoc = z.object({
  ...commentTreeFields,
  replies: z.array(CommentLeafDoc),
});

const CommentResponseDoc = z
  .object({
    ...commentTreeFields,
    replies: z.array(CommentReplyDoc),
  })
  .meta({ id: 'CommentResponse' });

const PostDetailResponseDoc = z
  .object({
    ...postResponseSchema.shape,
    author: authorResponseSchema,
    comments: z.array(CommentResponseDoc),
  })
  .meta({ id: 'PostDetailResponse' });

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

  registry.registerPath({
    method: 'get',
    path: '/worlds/{slug}/posts/{postId}',
    tags: ['posts'],
    summary: 'Read a single post with its bounded threaded comment tree',
    request: {
      params: postDetailParamsSchema,
    },
    responses: {
      200: {
        description:
          'The post with its author, aggregated vote score, and the comment tree bounded at three levels.',
        content: {
          'application/json': {
            schema: PostDetailResponseDoc,
          },
        },
      },
      404: {
        description:
          'No active world exists with the given slug, or no post with the given id exists in that world.',
      },
    },
  });
}
