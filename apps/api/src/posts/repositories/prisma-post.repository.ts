import { Paginated } from '@aiworld/shared/schemas/pagination.schema';
import { ListPostsQuery } from '@aiworld/shared/schemas/post.schema';
import { Injectable } from '@nestjs/common';

import { Prisma, Post } from '@/generated/prisma/client';
import { PrismaService } from '@/lib/database/prisma.service';
import { compareByHot } from '@/posts/domain/post-ranking';
import { PostRecord } from '@/posts/domain/post-record';
import { PostRepository } from '@/posts/repositories/post-repository.interface';

const postSelect = {
  id: true,
  title: true,
  content: true,
  createdAt: true,
  updatedAt: true,
} as const;

type PostFeedRow = Pick<
  Post,
  'id' | 'title' | 'content' | 'createdAt' | 'updatedAt'
>;

const newOrderBy: Prisma.PostOrderByWithRelationInput[] = [
  { createdAt: 'desc' },
  { id: 'asc' },
];

@Injectable()
export class PrismaPostRepository extends PostRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findFeed(
    worldId: string,
    query: ListPostsQuery,
  ): Promise<Paginated<PostRecord>> {
    const { sort, page, limit } = query;

    if (sort === 'new') {
      const [posts, total] = await Promise.all([
        this.prisma.post.findMany({
          where: { worldId },
          select: postSelect,
          orderBy: newOrderBy,
          skip: (page - 1) * limit,
          take: limit,
        }),
        this.prisma.post.count({ where: { worldId } }),
      ]);
      const scores = await this.aggregateVoteScores(
        posts.map((post) => post.id),
      );

      return {
        items: posts.map((post) => this.mapToRecord(post, scores)),
        meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
      };
    }

    const posts = await this.prisma.post.findMany({
      where: { worldId },
      select: postSelect,
      orderBy: newOrderBy,
    });
    const scores = await this.aggregateVoteScores(posts.map((post) => post.id));
    const ranked = posts
      .map((post) => this.mapToRecord(post, scores))
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

  /**
   * Aggregates Vote rows into per-post scores in one grouped query. Only
   * votes from active WorldMembers count (ADR-0002: rows are the only source
   * of truth, and a deactivated member no longer participates).
   */
  private async aggregateVoteScores(
    postIds: string[],
  ): Promise<Map<string, number>> {
    if (postIds.length === 0) {
      return new Map();
    }

    const rows = await this.prisma.vote.groupBy({
      by: ['postId'],
      where: { postId: { in: postIds }, author: { isActive: true } },
      _sum: { value: true },
    });

    const scores = new Map<string, number>();
    for (const row of rows) {
      if (row.postId) {
        scores.set(row.postId, row._sum.value ?? 0);
      }
    }
    return scores;
  }
}
