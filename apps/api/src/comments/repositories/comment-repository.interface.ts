import { ActivityCursor } from '@/activity/domain/activity-cursor';
import { FlatCommentRecord } from '@/comments/domain/comment-record';

export abstract class CommentRepository {
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
}
