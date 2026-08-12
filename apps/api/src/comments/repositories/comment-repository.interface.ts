import { ActivityCursor } from '@/activity/domain/activity-cursor';
import { FlatCommentRecord } from '@/comments/domain/comment-record';

export type CommentLinkRecord = {
  id: string;
  postId: string;
  parentCommentId: string | null;
};

export abstract class CommentRepository {
  abstract findById(id: string): Promise<CommentLinkRecord | null>;
  abstract findByPostId(postId: string): Promise<FlatCommentRecord[]>;
  abstract findByAuthorMembership(
    worldId: string,
    authorMemberId: string,
    cursor: ActivityCursor | null,
    limit: number,
  ): Promise<FlatCommentRecord[]>;
  abstract searchByText(
    worldId: string,
    q: string,
  ): Promise<FlatCommentRecord[]>;
  abstract countByPostIds(postIds: string[]): Promise<Map<string, number>>;
  abstract create(input: {
    postId: string;
    authorMemberId: string;
    parentCommentId: string | null;
    content: string;
  }): Promise<{ id: string }>;
}
