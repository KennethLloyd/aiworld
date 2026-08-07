import { ListPostsResponse } from '@aiworld/shared/schemas/post-response.schema';
import { listPostsQuerySchema } from '@aiworld/shared/schemas/post.schema';
import type { ListPostsQuery } from '@aiworld/shared/schemas/post.schema';
import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
} from '@nestjs/common';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';

import { ZodValidationPipe } from '@/common/pipes';
import { PostResponseMapper } from '@/posts/mappers/post-response.mapper';
import { PostsService } from '@/posts/posts.service';

@Controller('worlds/:slug/posts')
export class PostsController {
  constructor(
    private readonly postsService: PostsService,
    private readonly postResponseMapper: PostResponseMapper,
  ) {}

  @Get()
  @AllowAnonymous()
  async list(
    @Param('slug') slug: string,
    @Query(new ZodValidationPipe(listPostsQuerySchema))
    query: ListPostsQuery,
  ): Promise<ListPostsResponse> {
    const feed = await this.postsService.findFeed(slug, query);

    if (!feed) {
      throw new NotFoundException();
    }

    return this.postResponseMapper.mapToPaginatedPostResponse(feed);
  }
}
