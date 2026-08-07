import { FlatCommentRecord } from '@/comments/domain/comment-record';

export abstract class CommentRepository {
  abstract findByPostId(postId: string): Promise<FlatCommentRecord[]>;
  abstract findByAuthorMembership(
    worldId: string,
    authorMemberId: string,
  ): Promise<FlatCommentRecord[]>;
  abstract searchByText(
    worldId: string,
    q: string,
  ): Promise<FlatCommentRecord[]>;
  abstract countByPostIds(postIds: string[]): Promise<Map<string, number>>;
}
