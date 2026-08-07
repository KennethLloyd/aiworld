import { Injectable } from '@nestjs/common';

import { FlatCommentRecord } from '@/comments/domain/comment-record';
import {
  ContentAuthorRow,
  mapContentAuthor,
} from '@/comments/domain/content-author';
import { CommentRepository } from '@/comments/repositories/comment-repository.interface';
import { prismaContentAuthorSelect } from '@/comments/repositories/prisma-content-author-select';
import { Prisma, Comment } from '@/generated/prisma/client';
import { PrismaService } from '@/lib/database/prisma.service';
import { aggregateCommentVoteScores } from '@/votes/vote-aggregation';

const commentSelect = {
  id: true,
  postId: true,
  parentCommentId: true,
  content: true,
  createdAt: true,
  updatedAt: true,
  author: prismaContentAuthorSelect,
} as const;

type CommentRow = Pick<
  Comment,
  'id' | 'postId' | 'parentCommentId' | 'content' | 'createdAt' | 'updatedAt'
> & {
  author: ContentAuthorRow;
};

const commentOrderBy: Prisma.CommentOrderByWithRelationInput[] = [
  { createdAt: 'asc' },
  { id: 'asc' },
];

@Injectable()
export class PrismaCommentRepository extends CommentRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findByPostId(postId: string): Promise<FlatCommentRecord[]> {
    const comments = await this.prisma.comment.findMany({
      where: { postId },
      select: commentSelect,
      orderBy: commentOrderBy,
    });
    const scores = await aggregateCommentVoteScores(
      this.prisma,
      comments.map((c) => c.id),
    );

    return comments.map((comment) => this.mapToRecord(comment, scores));
  }

  private mapToRecord(
    comment: CommentRow,
    scores: Map<string, number>,
  ): FlatCommentRecord {
    return {
      id: comment.id,
      postId: comment.postId,
      parentCommentId: comment.parentCommentId,
      author: mapContentAuthor(comment.author),
      content: comment.content,
      voteScore: scores.get(comment.id) ?? 0,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
    };
  }
}
