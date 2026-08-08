import { Module } from '@nestjs/common';

import { CommentResponseMapper } from '@/comments/mappers/comment-response.mapper';
import { CommentRepository } from '@/comments/repositories/comment-repository.interface';
import { PrismaCommentRepository } from '@/comments/repositories/prisma-comment.repository';

@Module({
  providers: [
    {
      provide: CommentRepository,
      useClass: PrismaCommentRepository,
    },
    CommentResponseMapper,
  ],
  exports: [CommentRepository, CommentResponseMapper],
})
export class CommentsModule {}
