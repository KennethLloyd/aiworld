import { CursorPaginated } from '@aiworld/shared/schemas/pagination.schema';
import { Injectable } from '@nestjs/common';

import { ActivityCursor } from '@/activity/domain/activity-cursor';
import {
  ContentAuthorRow,
  mapContentAuthor,
} from '@/comments/domain/content-author';
import { CommentRepository } from '@/comments/repositories/comment-repository.interface';
import { prismaContentAuthorSelect } from '@/comments/repositories/prisma-content-author-select';
import { Prisma, Post } from '@/generated/prisma/client';
import { PrismaService } from '@/lib/database/prisma.service';
import { escapeSearchText } from '@/lib/search-text';
import {
  encodePostFeedCursor,
  type PostFeedCursor,
} from '@/posts/domain/post-feed-cursor';
import {
  PostFeedRecord,
  PostRecord,
  PostWithAuthorRecord,
} from '@/posts/domain/post-record';
import {
  PostFeedQuery,
  PostRepository,
} from '@/posts/repositories/post-repository.interface';

const postSelect = {
  id: true,
  title: true,
  content: true,
  voteScore: true,
  createdAt: true,
  updatedAt: true,
} as const;

const postWithAuthorSelect = {
  ...postSelect,
  author: prismaContentAuthorSelect,
} as const;

type PostFeedRow = Pick<
  Post,
  'id' | 'title' | 'content' | 'voteScore' | 'createdAt' | 'updatedAt'
>;

type PostWithAuthorRow = PostFeedRow & {
  author: ContentAuthorRow;
};

const newOrderBy: Prisma.PostOrderByWithRelationInput[] = [
  { createdAt: 'desc' },
  { id: 'asc' },
];

const hotOrderBy: Prisma.PostOrderByWithRelationInput[] = [
  { voteScore: 'desc' },
  { createdAt: 'desc' },
  { id: 'asc' },
];

const searchOrderBy: Prisma.PostOrderByWithRelationInput[] = [
  { createdAt: 'desc' },
  { id: 'desc' },
];

const activityOrderBy: Prisma.PostOrderByWithRelationInput[] = [
  { createdAt: 'desc' },
  { id: 'desc' },
];

/** Keyset filter: strictly after the cursor in the activity order. */
function activityCursorFilter(cursor: ActivityCursor): Prisma.PostWhereInput {
  return {
    OR: [
      { createdAt: { lt: cursor.createdAt } },
      { createdAt: cursor.createdAt, id: { lt: cursor.id } },
    ],
  };
}

function newFeedCursorFilter(cursor: PostFeedCursor): Prisma.PostWhereInput {
  return {
    OR: [
      { createdAt: { lt: cursor.createdAt } },
      { createdAt: cursor.createdAt, id: { gt: cursor.id } },
    ],
  };
}

function hotFeedCursorFilter(cursor: PostFeedCursor): Prisma.PostWhereInput {
  return {
    OR: [
      { voteScore: { lt: cursor.voteScore } },
      {
        voteScore: cursor.voteScore,
        createdAt: { lt: cursor.createdAt },
      },
      {
        voteScore: cursor.voteScore,
        createdAt: cursor.createdAt,
        id: { gt: cursor.id },
      },
    ],
  };
}

@Injectable()
export class PrismaPostRepository extends PostRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly commentRepository: CommentRepository,
  ) {
    super();
  }

  async findFeed(
    worldId: string,
    query: PostFeedQuery,
  ): Promise<CursorPaginated<PostFeedRecord>> {
    const { sort, cursor, limit } = query;
    const posts = await this.prisma.post.findMany({
      where: {
        worldId,
        ...(cursor
          ? sort === 'hot'
            ? hotFeedCursorFilter(cursor)
            : newFeedCursorFilter(cursor)
          : {}),
      },
      select: postWithAuthorSelect,
      orderBy: sort === 'hot' ? hotOrderBy : newOrderBy,
      take: limit + 1,
    });
    const pagePosts = posts.slice(0, limit);
    const commentCounts = await this.commentRepository.countByPostIds(
      pagePosts.map((post) => post.id),
    );

    return {
      items: pagePosts.map((post) => this.mapToFeedRecord(post, commentCounts)),
      nextCursor:
        posts.length > limit
          ? encodePostFeedCursor(
              this.mapToFeedRecord(
                pagePosts[pagePosts.length - 1]!,
                commentCounts,
              ),
              sort,
            )
          : null,
    };
  }

  async findById(
    worldId: string,
    postId: string,
  ): Promise<PostWithAuthorRecord | null> {
    const post = await this.prisma.post.findFirst({
      where: { id: postId, worldId },
      select: postWithAuthorSelect,
    });

    return post ? this.mapToWithAuthorRecord(post) : null;
  }

  async findByAuthorMembership(
    worldId: string,
    authorMemberId: string,
    cursor: ActivityCursor | null,
    limit: number,
  ): Promise<PostWithAuthorRecord[]> {
    const posts = await this.prisma.post.findMany({
      where: {
        worldId,
        authorMemberId,
        ...(cursor ? activityCursorFilter(cursor) : {}),
      },
      select: postWithAuthorSelect,
      orderBy: activityOrderBy,
      take: limit,
    });

    return posts.map((post) => this.mapToWithAuthorRecord(post));
  }

  async searchByText(
    worldId: string,
    q: string,
  ): Promise<PostWithAuthorRecord[]> {
    const pattern = escapeSearchText(q);
    const posts = await this.prisma.post.findMany({
      where: {
        worldId,
        OR: [
          { title: { contains: pattern, mode: 'insensitive' } },
          { content: { contains: pattern, mode: 'insensitive' } },
        ],
      },
      select: postWithAuthorSelect,
      orderBy: searchOrderBy,
    });

    return posts.map((post) => this.mapToWithAuthorRecord(post));
  }

  async create(input: {
    worldId: string;
    authorMemberId: string;
    title: string;
    content: string;
  }): Promise<{ id: string }> {
    const post = await this.prisma.post.create({ data: input });
    return { id: post.id };
  }

  private mapToRecord(post: PostFeedRow): PostRecord {
    return {
      id: post.id,
      title: post.title,
      content: post.content,
      voteScore: post.voteScore,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
    };
  }

  private mapToWithAuthorRecord(post: PostWithAuthorRow): PostWithAuthorRecord {
    return {
      ...this.mapToRecord(post),
      author: mapContentAuthor(post.author),
    };
  }

  private mapToFeedRecord(
    post: PostWithAuthorRow,
    commentCounts: Map<string, number>,
  ): PostFeedRecord {
    return {
      ...this.mapToWithAuthorRecord(post),
      commentCount: commentCounts.get(post.id) ?? 0,
    };
  }
}
