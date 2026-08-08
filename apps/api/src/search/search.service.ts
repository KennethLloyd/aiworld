import { Paginated } from '@aiworld/shared/schemas/pagination.schema';
import { SearchQuery } from '@aiworld/shared/schemas/search.schema';
import { Injectable } from '@nestjs/common';

import { CommentRepository } from '@/comments/repositories/comment-repository.interface';
import { PostRepository } from '@/posts/repositories/post-repository.interface';
import {
  compareSearchResults,
  SearchResultRecord,
} from '@/search/domain/search-record';
import { WorldService } from '@/world/world.service';

const MIN_QUERY_LENGTH = 2;

@Injectable()
export class SearchService {
  constructor(
    private readonly worldService: WorldService,
    private readonly postRepository: PostRepository,
    private readonly commentRepository: CommentRepository,
  ) {}

  async search(
    worldSlug: string,
    query: SearchQuery,
  ): Promise<Paginated<SearchResultRecord> | null> {
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
      this.postRepository.searchByText(world.id, q),
      this.commentRepository.searchByText(world.id, q),
    ]);

    const merged: SearchResultRecord[] = [
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
