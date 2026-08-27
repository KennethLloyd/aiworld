import { CursorPaginated } from '@aiworld/shared/schemas/pagination.schema';
import type { PostSort } from '@aiworld/shared/schemas/post.schema';

import { ActivityCursor } from '@/activity/domain/activity-cursor';
import { PostFeedCursor } from '@/posts/domain/post-feed-cursor';
import {
  PostFeedRecord,
  PostWithAuthorRecord,
} from '@/posts/domain/post-record';

export interface PostFeedQuery {
  sort: PostSort;
  cursor: PostFeedCursor | null;
  limit: number;
}

export abstract class PostRepository {
  abstract findFeed(
    worldId: string,
    query: PostFeedQuery,
  ): Promise<CursorPaginated<PostFeedRecord>>;
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
  abstract create(input: {
    worldId: string;
    authorMemberId: string;
    title: string;
    content: string;
  }): Promise<{ id: string }>;
}
