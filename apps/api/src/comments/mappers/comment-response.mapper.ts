import { CommentResponse } from '@aiworld/shared/schemas/comment-response.schema';
import { Injectable } from '@nestjs/common';

import { CommentRecord } from '@/comments/domain/comment-record';

@Injectable()
export class CommentResponseMapper {
  mapToCommentResponse(record: CommentRecord): CommentResponse {
    return {
      id: record.id,
      author: record.author,
      content: record.content,
      voteScore: record.voteScore,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
      replies: record.replies.map((reply) => this.mapToCommentResponse(reply)),
    };
  }
}
