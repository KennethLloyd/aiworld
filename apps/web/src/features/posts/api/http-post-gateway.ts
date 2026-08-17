import {
  listPostsResponseSchema,
  type ListPostsResponse,
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
}
