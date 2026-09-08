import { CommentResponse } from '@aiworld/shared/schemas/comment-response.schema';

import { Comment } from '@/comments/domain/comment';

export function mapCommentResponse(comment: Comment): CommentResponse {
  return {
    id: comment.id,
    author: comment.author,
    content: comment.content,
    voteScore: comment.voteScore,
    createdAt: comment.createdAt.toISOString(),
    updatedAt: comment.updatedAt.toISOString(),
    replies: comment.replies.map(mapCommentResponse),
  };
}
