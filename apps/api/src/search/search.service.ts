import { Paginated } from '@aiworld/shared/schemas/pagination.schema';
import { SearchQuery } from '@aiworld/shared/schemas/search.schema';
import { Injectable } from '@nestjs/common';

import { CommentsService } from '@/comments/comments.service';
import { PostsService } from '@/posts/posts.service';
import { compareSearchResults, SearchResult } from '@/search/domain/search';
import { WorldService } from '@/world/world.service';

const MIN_QUERY_LENGTH = 2;

@Injectable()
export class SearchService {
  constructor(
    private readonly worldService: WorldService,
    private readonly postsService: PostsService,
    private readonly commentsService: CommentsService,
  ) {}

  async search(
    worldSlug: string,
    query: SearchQuery,
  ): Promise<Paginated<SearchResult> | null> {
    const world = await this.worldService.getBySlug(worldSlug, false);
    if (!world) {
      return null;
    }

    const { page, limit } = query;
    const q = query.q?.trim() ?? '';

    if (q.length < MIN_QUERY_LENGTH) {
      return {
        items: [],
        meta: { page, limit, total: 0, totalPages: 0 },
      };
    }

    const [posts, comments] = await Promise.all([
      this.postsService.searchByText(world.id, q),
      this.commentsService.searchByText(world.id, q),
    ]);

    const merged: SearchResult[] = [
      ...posts.map((post) => ({ type: 'post' as const, post })),
      ...comments.map((comment) => ({ type: 'comment' as const, comment })),
    ].sort(compareSearchResults);

    const total = merged.length;
    const pageItems = merged.slice((page - 1) * limit, page * limit);

    return {
      items: pageItems,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }
}
