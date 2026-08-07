import { Paginated } from '@aiworld/shared/schemas/pagination.schema';
import { ListPostsQuery } from '@aiworld/shared/schemas/post.schema';

import { PostRecord } from '@/posts/domain/post-record';

export abstract class PostRepository {
  abstract findFeed(
    worldId: string,
    query: ListPostsQuery,
  ): Promise<Paginated<PostRecord>>;
}
