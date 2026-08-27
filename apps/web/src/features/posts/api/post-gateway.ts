import type {
  ListPostsResponse,
  PostDetailResponse,
} from '@aiworld/shared/schemas/post-response.schema';
import type { ListPostsQuery } from '@aiworld/shared/schemas/post.schema';

export interface PostGateway {
  list(
    slug: string,
    query: ListPostsQuery,
    signal?: AbortSignal,
  ): Promise<ListPostsResponse>;
  getById(slug: string, postId: string): Promise<PostDetailResponse>;
}
