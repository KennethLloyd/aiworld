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
import { compareByHot } from '@/posts/domain/post-ranking';
import {
  PostFeedRecord,
  PostRecord,
  PostWithAuthorRecord,
} from '@/posts/domain/post-record';
import {
  PostFeedQuery,
  PostRepository,
} from '@/posts/repositories/post-repository.interface';
import { aggregatePostVoteScores } from '@/votes/vote-aggregation';

const postSelect = {
  id: true,
  title: true,
  content: true,
  createdAt: true,
  updatedAt: true,
} as const;

const postWithAuthorSelect = {
  ...postSelect,
  author: prismaContentAuthorSelect,
} as const;

type PostFeedRow = Pick<
  Post,
  'id' | 'title' | 'content' | 'createdAt' | 'updatedAt'
>;

type PostWithAuthorRow = PostFeedRow & {
  author: ContentAuthorRow;
};

const newOrderBy: Prisma.PostOrderByWithRelationInput[] = [
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

function isAfterHotCursor(
  post: PostFeedRecord,
  cursor: PostFeedCursor,
): boolean {
  const createdAt = post.createdAt.getTime();
  const cursorCreatedAt = cursor.createdAt.getTime();
  return (
    post.voteScore < cursor.voteScore ||
    (post.voteScore === cursor.voteScore &&
      (createdAt < cursorCreatedAt ||
        (createdAt === cursorCreatedAt && post.id > cursor.id)))
  );
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

    if (sort === 'new') {
      const posts = await this.prisma.post.findMany({
        where: {
          worldId,
          ...(cursor ? newFeedCursorFilter(cursor) : {}),
        },
        select: postWithAuthorSelect,
        orderBy: newOrderBy,
        take: limit + 1,
      });
      const pagePosts = posts.slice(0, limit);
      const scores = await aggregatePostVoteScores(
        this.prisma,
        pagePosts.map((post) => post.id),
      );
      const commentCounts = await this.commentRepository.countByPostIds(
        pagePosts.map((post) => post.id),
      );

      return {
        items: pagePosts.map((post) =>
          this.mapToFeedRecord(post, scores, commentCounts),
        ),
        nextCursor:
          posts.length > limit
            ? encodePostFeedCursor(
                this.mapToFeedRecord(
                  pagePosts[pagePosts.length - 1]!,
                  scores,
                  commentCounts,
                ),
                sort,
              )
            : null,
      };
    }

    const posts = await this.prisma.post.findMany({
      where: { worldId },
      select: postWithAuthorSelect,
      orderBy: newOrderBy,
    });
    const scores = await aggregatePostVoteScores(
      this.prisma,
      posts.map((post) => post.id),
    );
    const commentCounts = await this.commentRepository.countByPostIds(
      posts.map((post) => post.id),
    );
    const ranked = posts
      .map((post) => this.mapToFeedRecord(post, scores, commentCounts))
      .sort(compareByHot);
    const remaining = cursor
      ? ranked.filter((post) => isAfterHotCursor(post, cursor))
      : ranked;
    const pageItems = remaining.slice(0, limit);

    return {
      items: pageItems,
      nextCursor:
        remaining.length > limit
          ? encodePostFeedCursor(pageItems[pageItems.length - 1]!, sort)
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

    if (!post) {
      return null;
    }

    const scores = await aggregatePostVoteScores(this.prisma, [post.id]);
    return this.mapToWithAuthorRecord(post, scores);
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
    const scores = await aggregatePostVoteScores(
      this.prisma,
      posts.map((post) => post.id),
    );

    return posts.map((post) => this.mapToWithAuthorRecord(post, scores));
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
    const scores = await aggregatePostVoteScores(
      this.prisma,
      posts.map((post) => post.id),
    );

    return posts.map((post) => this.mapToWithAuthorRecord(post, scores));
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

  private mapToRecord(
    post: PostFeedRow,
    scores: Map<string, number>,
  ): PostRecord {
    return {
      id: post.id,
      title: post.title,
      content: post.content,
      voteScore: scores.get(post.id) ?? 0,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
    };
  }

  private mapToWithAuthorRecord(
    post: PostWithAuthorRow,
    scores: Map<string, number>,
  ): PostWithAuthorRecord {
    return {
      ...this.mapToRecord(post, scores),
      author: mapContentAuthor(post.author),
    };
  }

  private mapToFeedRecord(
    post: PostWithAuthorRow,
    scores: Map<string, number>,
    commentCounts: Map<string, number>,
  ): PostFeedRecord {
    return {
      ...this.mapToWithAuthorRecord(post, scores),
      commentCount: commentCounts.get(post.id) ?? 0,
    };
  }
}
