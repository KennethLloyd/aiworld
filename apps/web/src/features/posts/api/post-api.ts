import {
  listPostsResponseSchema,
  postDetailResponseSchema,
  type ListPostsResponse,
  type PostDetailResponse,
} from '@aiworld/shared/schemas/post-response.schema';
import type { ListPostsQuery } from '@aiworld/shared/schemas/post.schema';

import { apiClient } from '@/core/api/http-client';

import { postEndpoints } from './post-endpoints';

export async function listPosts(
  slug: string,
  query: ListPostsQuery,
  signal?: AbortSignal,
): Promise<ListPostsResponse> {
  const raw = await apiClient.get<unknown>(
    postEndpoints.list(slug, query),
    signal,
  );
  return listPostsResponseSchema.parse(raw);
}

export async function getPostById(
  slug: string,
  postId: string,
): Promise<PostDetailResponse> {
  const raw = await apiClient.get<unknown>(postEndpoints.detail(slug, postId));
  return postDetailResponseSchema.parse(raw);
}
