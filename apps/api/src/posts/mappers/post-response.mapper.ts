import { Paginated } from '@aiworld/shared/schemas/pagination.schema';
import {
  ListPostsResponse,
  PostResponse,
} from '@aiworld/shared/schemas/post-response.schema';
import { Injectable } from '@nestjs/common';

import { PostRecord } from '@/posts/domain/post-record';

@Injectable()
export class PostResponseMapper {
  mapToPostResponse(record: PostRecord): PostResponse {
    return {
      id: record.id,
      title: record.title,
      content: record.content,
      voteScore: record.voteScore,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }

  mapToPaginatedPostResponse(
    paginatedRecords: Paginated<PostRecord>,
  ): ListPostsResponse {
    return {
      items: paginatedRecords.items.map((item) => this.mapToPostResponse(item)),
      meta: paginatedRecords.meta,
    };
  }
}
