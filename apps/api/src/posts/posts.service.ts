import { CursorPaginated } from '@aiworld/shared/schemas/pagination.schema';
import { ListPostsQuery } from '@aiworld/shared/schemas/post.schema';
import { BadRequestException, Injectable } from '@nestjs/common';

import { ActivityCursor } from '@/activity/domain/activity-cursor';
import { CommentsService } from '@/comments/comments.service';
import { buildCommentTree } from '@/comments/domain/comment-tree';
import {
  ContentAuthorRow,
  mapContentAuthor,
} from '@/comments/domain/content-author';
import { prismaContentAuthorSelect } from '@/comments/prisma-content-author-select';
import { Prisma, Post as PrismaPost } from '@/generated/prisma/client';
import { PrismaService } from '@/lib/database/prisma.service';
import { escapeSearchText } from '@/lib/search-text';
import { FeedPost, PostDetail, PostWithAuthor } from '@/posts/domain/post';
import {
  encodePostFeedCursor,
  parsePostFeedCursor,
  PostFeedCursor,
} from '@/posts/domain/post-feed-cursor';
import { WorldService } from '@/world/world.service';

const postWithAuthorSelect = {
  id: true,
  title: true,
  content: true,
  voteScore: true,
  createdAt: true,
  updatedAt: true,
  author: prismaContentAuthorSelect,
} as const;

type PostWithAuthorRow = Pick<
  PrismaPost,
  'id' | 'title' | 'content' | 'voteScore' | 'createdAt' | 'updatedAt'
> & { author: ContentAuthorRow };

const newOrderBy: Prisma.PostOrderByWithRelationInput[] = [
  { createdAt: 'desc' },
  { id: 'asc' },
];
const hotOrderBy: Prisma.PostOrderByWithRelationInput[] = [
  { voteScore: 'desc' },
  { createdAt: 'desc' },
  { id: 'asc' },
];
const newestFirstOrder: Prisma.PostOrderByWithRelationInput[] = [
  { createdAt: 'desc' },
  { id: 'desc' },
];

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
      { voteScore: cursor.voteScore, createdAt: { lt: cursor.createdAt } },
      {
        voteScore: cursor.voteScore,
        createdAt: cursor.createdAt,
        id: { gt: cursor.id },
      },
    ],
  };
}

function activityCursorFilter(cursor: ActivityCursor): Prisma.PostWhereInput {
  return {
    OR: [
      { createdAt: { lt: cursor.createdAt } },
      { createdAt: cursor.createdAt, id: { lt: cursor.id } },
    ],
  };
}

@Injectable()
export class PostsService {
  constructor(
    private readonly worldService: WorldService,
    private readonly prisma: PrismaService,
    private readonly commentsService: CommentsService,
  ) {}

  async findFeed(
    worldSlug: string,
    query: ListPostsQuery,
  ): Promise<CursorPaginated<FeedPost> | null> {
    const world = await this.worldService.getBySlug(worldSlug, false);
    if (!world) {
      return null;
    }

    const parsedCursor = parsePostFeedCursor(query.cursor, query.sort);
    if (!parsedCursor.ok) {
      throw new BadRequestException({
        statusCode: 400,
        message: [
          { code: 'custom', path: ['cursor'], message: 'Invalid cursor.' },
        ],
        error: 'Validation Failed',
      });
    }

    const posts = await this.prisma.post.findMany({
      where: {
        worldId: world.id,
        ...(parsedCursor.cursor
          ? query.sort === 'hot'
            ? hotFeedCursorFilter(parsedCursor.cursor)
            : newFeedCursorFilter(parsedCursor.cursor)
          : {}),
      },
      select: postWithAuthorSelect,
      orderBy: query.sort === 'hot' ? hotOrderBy : newOrderBy,
      take: query.limit + 1,
    });
    const pagePosts = posts.slice(0, query.limit);
    const commentCounts = await this.commentsService.countByPostIds(
      pagePosts.map((post) => post.id),
    );

    return {
      items: pagePosts.map((post) =>
        mapFeedPost(post, commentCounts.get(post.id) ?? 0),
      ),
      nextCursor:
        posts.length > query.limit
          ? encodePostFeedCursor(
              mapFeedPost(
                pagePosts[pagePosts.length - 1]!,
                commentCounts.get(pagePosts[pagePosts.length - 1]!.id) ?? 0,
              ),
              query.sort,
            )
          : null,
    };
  }

  async findByWorldSlug(
    worldSlug: string,
    postId: string,
  ): Promise<PostDetail | null> {
    const world = await this.worldService.getBySlug(worldSlug, false);
    if (!world) {
      return null;
    }

    const post = await this.prisma.post.findFirst({
      where: { id: postId, worldId: world.id },
      select: postWithAuthorSelect,
    });
    if (!post) {
      return null;
    }

    const comments = await this.commentsService.findByPostId(post.id);

    return {
      ...mapPostWithAuthor(post),
      comments: buildCommentTree(comments),
    };
  }

  async findById(
    worldId: string,
    postId: string,
  ): Promise<PostWithAuthor | null> {
    const post = await this.prisma.post.findFirst({
      where: { id: postId, worldId },
      select: postWithAuthorSelect,
    });
    return post ? mapPostWithAuthor(post) : null;
  }

  async findRecentByWorld(
    worldId: string,
    limit: number,
  ): Promise<PostWithAuthor[]> {
    const posts = await this.prisma.post.findMany({
      where: { worldId },
      select: postWithAuthorSelect,
      orderBy: newOrderBy,
      take: limit,
    });
    return posts.map(mapPostWithAuthor);
  }

  async findByAuthorMembership(
    worldId: string,
    authorMemberId: string,
    cursor: ActivityCursor | null,
    limit: number,
  ): Promise<PostWithAuthor[]> {
    const posts = await this.prisma.post.findMany({
      where: {
        worldId,
        authorMemberId,
        ...(cursor ? activityCursorFilter(cursor) : {}),
      },
      select: postWithAuthorSelect,
      orderBy: newestFirstOrder,
      take: limit,
    });
    return posts.map(mapPostWithAuthor);
  }

  async searchByText(worldId: string, q: string): Promise<PostWithAuthor[]> {
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
      orderBy: newestFirstOrder,
    });
    return posts.map(mapPostWithAuthor);
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
}

function mapPostWithAuthor(post: PostWithAuthorRow): PostWithAuthor {
  return {
    id: post.id,
    title: post.title,
    content: post.content,
    voteScore: post.voteScore,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
    author: mapContentAuthor(post.author),
  };
}

function mapFeedPost(post: PostWithAuthorRow, commentCount: number): FeedPost {
  return { ...mapPostWithAuthor(post), commentCount };
}
