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

// zod-to-openapi cannot generate recursive schemas (verified on 9.1.0,
// upstream issue #372). Mirror the API's bounded three-level tree instead.
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
