import { Paginated } from '@aiworld/shared/schemas/pagination.schema';
import { ListPostsQuery } from '@aiworld/shared/schemas/post.schema';

import { ActivityCursor } from '@/activity/domain/activity-cursor';
import { PostRecord, PostWithAuthorRecord } from '@/posts/domain/post-record';

export abstract class PostRepository {
  abstract findFeed(
    worldId: string,
    query: ListPostsQuery,
  ): Promise<Paginated<PostRecord>>;
  abstract findById(
    worldId: string,
    postId: string,
  ): Promise<PostWithAuthorRecord | null>;
  abstract findByAuthorMembership(
    worldId: string,
    authorMemberId: string,
    cursor: ActivityCursor | null,
    limit: number,
  ): Promise<PostWithAuthorRecord[]>;
  abstract searchByText(
    worldId: string,
    q: string,
  ): Promise<PostWithAuthorRecord[]>;
}
