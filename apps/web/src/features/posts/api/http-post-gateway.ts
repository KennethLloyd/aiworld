import {
  listPostsResponseSchema,
  postDetailResponseSchema,
  type ListPostsResponse,
  type PostDetailResponse,
} from '@aiworld/shared/schemas/post-response.schema';
import type { ListPostsQuery } from '@aiworld/shared/schemas/post.schema';

import type { HttpClient } from '@/core/api/http-client';

import { postEndpoints } from './post-endpoints';
import type { PostGateway } from './post-gateway';

export class HttpPostGateway implements PostGateway {
  constructor(private readonly http: HttpClient) {}

  async list(slug: string, query: ListPostsQuery): Promise<ListPostsResponse> {
    const raw = await this.http.get<unknown>(postEndpoints.list(slug, query));
    return listPostsResponseSchema.parse(raw);
  }

  async getById(slug: string, postId: string): Promise<PostDetailResponse> {
    const raw = await this.http.get<unknown>(
      postEndpoints.detail(slug, postId),
    );
    return postDetailResponseSchema.parse(raw);
  }
}
