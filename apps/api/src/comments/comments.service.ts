import { Injectable } from '@nestjs/common';

import { ActivityCursor } from '@/activity/domain/activity-cursor';
import { Comment, FlatComment } from '@/comments/domain/comment';
import {
  ContentAuthorRow,
  mapContentAuthor,
} from '@/comments/domain/content-author';
import { prismaContentAuthorSelect } from '@/comments/prisma-content-author-select';
import { Prisma, Comment as PrismaComment } from '@/generated/prisma/client';
import { PrismaService } from '@/lib/database/prisma.service';
import { escapeSearchText } from '@/lib/search-text';

export type CommentLink = Pick<
  PrismaComment,
  'id' | 'postId' | 'parentCommentId'
>;

const commentSelect = {
  id: true,
  postId: true,
  parentCommentId: true,
  content: true,
  voteScore: true,
  createdAt: true,
  updatedAt: true,
  author: prismaContentAuthorSelect,
  post: { select: { title: true } },
} as const;

type CommentRow = Pick<
  PrismaComment,
  | 'id'
  | 'postId'
  | 'parentCommentId'
  | 'content'
  | 'voteScore'
  | 'createdAt'
  | 'updatedAt'
> & {
  author: ContentAuthorRow;
  post: { title: string };
};

const chronologicalOrder: Prisma.CommentOrderByWithRelationInput[] = [
  { createdAt: 'asc' },
  { id: 'asc' },
];
const newestFirstOrder: Prisma.CommentOrderByWithRelationInput[] = [
  { createdAt: 'desc' },
  { id: 'desc' },
];

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
export class CommentsService {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string): Promise<CommentLink | null> {
    return this.prisma.comment.findUnique({
      where: { id },
      select: { id: true, postId: true, parentCommentId: true },
    });
  }

  async findByPostId(postId: string): Promise<FlatComment[]> {
    const comments = await this.prisma.comment.findMany({
      where: { postId },
      select: commentSelect,
      orderBy: chronologicalOrder,
    });
    return comments.map(mapComment);
  }

  async findByAuthorMembership(
    worldId: string,
    authorMemberId: string,
    cursor: ActivityCursor | null,
    limit: number,
  ): Promise<FlatComment[]> {
    const comments = await this.prisma.comment.findMany({
      where: {
        authorMemberId,
        post: { worldId },
        ...(cursor ? activityCursorFilter(cursor) : {}),
      },
      select: commentSelect,
      orderBy: newestFirstOrder,
      take: limit,
    });
    return comments.map(mapComment);
  }

  async searchByText(worldId: string, q: string): Promise<FlatComment[]> {
    const pattern = escapeSearchText(q);
    const comments = await this.prisma.comment.findMany({
      where: {
        content: { contains: pattern, mode: 'insensitive' },
        post: { worldId },
      },
      select: commentSelect,
      orderBy: newestFirstOrder,
    });
    return comments.map(mapComment);
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
    return new Map(rows.map((row) => [row.postId, row._count._all]));
  }

  async create(input: {
    postId: string;
    authorMemberId: string;
    parentCommentId: string | null;
    content: string;
  }): Promise<{ id: string }> {
    const comment = await this.prisma.comment.create({ data: input });
    return { id: comment.id };
  }
}

function mapComment(comment: CommentRow): FlatComment {
  return {
    id: comment.id,
    postId: comment.postId,
    parentCommentId: comment.parentCommentId,
    author: mapContentAuthor(comment.author),
    content: comment.content,
    voteScore: comment.voteScore,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
    postTitle: comment.post.title,
  };
}

export type { Comment };
