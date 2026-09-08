import { Paginated } from '@aiworld/shared/schemas/pagination.schema';
import { SearchResponse } from '@aiworld/shared/schemas/search-response.schema';

import { mapCommentResponse } from '@/comments/mappers/comment-response.mapper';
import { mapPostWithAuthorResponse } from '@/posts/mappers/post-response.mapper';
import { SearchResult } from '@/search/domain/search';

export function mapSearchResponse(
  records: Paginated<SearchResult>,
): SearchResponse {
  return {
    items: records.items.map((record) => {
      if (record.type === 'post') {
        return {
          type: 'post' as const,
          post: mapPostWithAuthorResponse(record.post),
        };
      }
      const comment = mapCommentResponse({
        ...record.comment,
        replies: [],
      });
      return {
        type: 'comment' as const,
        // Search results are flat: comments never carry replies here.
        comment: {
          ...comment,
          postId: record.comment.postId,
          postTitle: record.comment.postTitle,
        },
      };
    }),
    meta: records.meta,
  };
}
