import { Injectable } from '@nestjs/common';

import { FlatCommentRecord } from '@/comments/domain/comment-record';
import { CommentRepository } from '@/comments/repositories/comment-repository.interface';
import { contentAuthorSelect } from '@/comments/repositories/content-author-select';
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
  author: contentAuthorSelect,
} as const;

type CommentRow = Pick<
  Comment,
  'id' | 'postId' | 'parentCommentId' | 'content' | 'createdAt' | 'updatedAt'
> & {
  author: {
    character: {
      id: string;
      handle: string;
      name: string;
      avatarUrl: string | null;
    } | null;
  } | null;
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
      author: comment.author?.character ?? null,
      content: comment.content,
      voteScore: scores.get(comment.id) ?? 0,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
    };
  }
}
