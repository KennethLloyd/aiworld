import { Paginated } from '@aiworld/shared/schemas/pagination.schema';
import { ListPostsQuery } from '@aiworld/shared/schemas/post.schema';
import { Injectable } from '@nestjs/common';

import {
  ContentAuthorRow,
  mapContentAuthor,
} from '@/comments/domain/content-author';
import { CommentRepository } from '@/comments/repositories/comment-repository.interface';
import { prismaContentAuthorSelect } from '@/comments/repositories/prisma-content-author-select';
import { Prisma, Post } from '@/generated/prisma/client';
import { PrismaService } from '@/lib/database/prisma.service';
import { escapeSearchText } from '@/lib/search-text';
import { compareByHot } from '@/posts/domain/post-ranking';
import {
  PostFeedRecord,
  PostRecord,
  PostWithAuthorRecord,
} from '@/posts/domain/post-record';
import { PostRepository } from '@/posts/repositories/post-repository.interface';
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
    query: ListPostsQuery,
  ): Promise<Paginated<PostFeedRecord>> {
    const { sort, page, limit } = query;

    if (sort === 'new') {
      const [posts, total] = await Promise.all([
        this.prisma.post.findMany({
          where: { worldId },
          select: postWithAuthorSelect,
          orderBy: newOrderBy,
          skip: (page - 1) * limit,
          take: limit,
        }),
        this.prisma.post.count({ where: { worldId } }),
      ]);
      const scores = await aggregatePostVoteScores(
        this.prisma,
        posts.map((post) => post.id),
      );
      const commentCounts = await this.commentRepository.countByPostIds(
        posts.map((post) => post.id),
      );

      return {
        items: posts.map((post) =>
          this.mapToFeedRecord(post, scores, commentCounts),
        ),
        meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
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
    const pageItems = ranked.slice((page - 1) * limit, page * limit);

    return {
      items: pageItems,
      meta: {
        page,
        limit,
        total: ranked.length,
        totalPages: Math.ceil(ranked.length / limit),
      },
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
  ): Promise<PostWithAuthorRecord[]> {
    const posts = await this.prisma.post.findMany({
      where: { worldId, authorMemberId },
      select: postWithAuthorSelect,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
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
