import { Paginated } from '@aiworld/shared/schemas/pagination.schema';
import { SearchResponse } from '@aiworld/shared/schemas/search-response.schema';
import { Injectable } from '@nestjs/common';

import { CommentResponseMapper } from '@/comments/mappers/comment-response.mapper';
import { PostResponseMapper } from '@/posts/mappers/post-response.mapper';
import { SearchResultRecord } from '@/search/domain/search-record';

@Injectable()
export class SearchResponseMapper {
  constructor(
    private readonly postResponseMapper: PostResponseMapper,
    private readonly commentResponseMapper: CommentResponseMapper,
  ) {}

  mapToSearchResponse(records: Paginated<SearchResultRecord>): SearchResponse {
    return {
      items: records.items.map((record) => {
        if (record.type === 'post') {
          return {
            type: 'post' as const,
            post: this.postResponseMapper.mapToPostWithAuthorResponse(
              record.post,
            ),
          };
        }
        return {
          type: 'comment' as const,
          // Search results are flat: comments never carry replies here.
          comment: this.commentResponseMapper.mapToCommentResponse({
            ...record.comment,
            replies: [],
          }),
        };
      }),
      meta: records.meta,
    };
  }
}
