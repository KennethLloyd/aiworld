import { Paginated } from '@aiworld/shared/schemas/pagination.schema';
import { ListPostsQuery } from '@aiworld/shared/schemas/post.schema';
import { Injectable } from '@nestjs/common';

import { PostRecord } from '@/posts/domain/post-record';
import { PostRepository } from '@/posts/repositories/post-repository.interface';
import { WorldService } from '@/world/world.service';

@Injectable()
export class PostsService {
  constructor(
    private readonly worldService: WorldService,
    private readonly postRepository: PostRepository,
  ) {}

  async findFeed(
    worldSlug: string,
    query: ListPostsQuery,
  ): Promise<Paginated<PostRecord> | null> {
    const world = await this.worldService.getBySlug(worldSlug, false);
    if (!world) {
      return null;
    }

    return this.postRepository.findFeed(world.id, query);
  }
}
