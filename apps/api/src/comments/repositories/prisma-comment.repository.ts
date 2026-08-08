import { Injectable } from '@nestjs/common';

import { ActivityCursor } from '@/activity/domain/activity-cursor';
import { FlatCommentRecord } from '@/comments/domain/comment-record';
import {
  ContentAuthorRow,
  mapContentAuthor,
} from '@/comments/domain/content-author';
import { CommentRepository } from '@/comments/repositories/comment-repository.interface';
import { prismaContentAuthorSelect } from '@/comments/repositories/prisma-content-author-select';
import { Prisma, Comment } from '@/generated/prisma/client';
import { PrismaService } from '@/lib/database/prisma.service';
import { escapeSearchText } from '@/lib/search-text';
import { aggregateCommentVoteScores } from '@/votes/vote-aggregation';

const commentSelect = {
  id: true,
  postId: true,
  parentCommentId: true,
  content: true,
  createdAt: true,
  updatedAt: true,
  author: prismaContentAuthorSelect,
  post: { select: { title: true } },
} as const;

const commentWithPostSelect = {
  ...commentSelect,
  post: { select: { title: true } },
} as const;

type CommentRow = Pick<
  Comment,
  'id' | 'postId' | 'parentCommentId' | 'content' | 'createdAt' | 'updatedAt'
> & {
  author: ContentAuthorRow;
  post: { title: string };
};

const commentOrderBy: Prisma.CommentOrderByWithRelationInput[] = [
  { createdAt: 'asc' },
  { id: 'asc' },
];

const searchOrderBy: Prisma.CommentOrderByWithRelationInput[] = [
  { createdAt: 'desc' },
  { id: 'desc' },
];

const activityCommentOrderBy: Prisma.CommentOrderByWithRelationInput[] = [
  { createdAt: 'desc' },
  { id: 'desc' },
];

/** Keyset filter: strictly after the cursor in the activity order. */
function activityCursorFilter(
  cursor: ActivityCursor,
): Prisma.CommentWhereInput {
  return {
    OR: [
      { createdAt: { lt: cursor.createdAt } },
      { createdAt: cursor.createdAt, id: { lt: cursor.id } },
    ],
  };
}

@Injectable()
export class PrismaCommentRepository extends CommentRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findByPostId(postId: string): Promise<FlatCommentRecord[]> {
    const comments = await this.prisma.comment.findMany({
      where: { postId },
      select: commentWithPostSelect,
      orderBy: commentOrderBy,
    });
    const scores = await aggregateCommentVoteScores(
      this.prisma,
      comments.map((c) => c.id),
    );

    return comments.map((comment) => this.mapToRecord(comment, scores));
  }

  async findByAuthorMembership(
    worldId: string,
    authorMemberId: string,
    cursor: ActivityCursor | null,
    limit: number,
  ): Promise<FlatCommentRecord[]> {
    const comments = await this.prisma.comment.findMany({
      where: {
        authorMemberId,
        post: { worldId },
        ...(cursor ? activityCursorFilter(cursor) : {}),
      },
      select: commentWithPostSelect,
      orderBy: activityCommentOrderBy,
      take: limit,
    });
    const scores = await aggregateCommentVoteScores(
      this.prisma,
      comments.map((c) => c.id),
    );

    return comments.map((comment) => this.mapToRecord(comment, scores));
  }

  async searchByText(worldId: string, q: string): Promise<FlatCommentRecord[]> {
    // World-scoped through the post relation: a comment belongs to a World
    // exactly when its post does, which is the no-leak guarantee.
    const pattern = escapeSearchText(q);
    const comments = await this.prisma.comment.findMany({
      where: {
        content: { contains: pattern, mode: 'insensitive' },
        post: { worldId },
      },
      select: commentSelect,
      orderBy: searchOrderBy,
    });
    const scores = await aggregateCommentVoteScores(
      this.prisma,
      comments.map((comment) => comment.id),
    );

    return comments.map((comment) => this.mapToRecord(comment, scores));
  }

  async countByPostIds(postIds: string[]): Promise<Map<string, number>> {
    if (postIds.length === 0) {
      return new Map();
    }

    const rows = await this.prisma.comment.groupBy({
      by: ['postId'],
      where: { postId: { in: postIds } },
      _count: { _all: true },
    });

    const counts = new Map<string, number>();
    for (const row of rows) {
      counts.set(row.postId, row._count._all);
    }
    return counts;
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
      postTitle: comment.post.title,
    };
  }
}
