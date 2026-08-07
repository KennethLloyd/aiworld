import { FlatCommentRecord } from '@/comments/domain/comment-record';

export abstract class CommentRepository {
  abstract findByPostId(postId: string): Promise<FlatCommentRecord[]>;
}
