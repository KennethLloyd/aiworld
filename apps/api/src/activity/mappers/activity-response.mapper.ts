import { CharacterActivityResponse } from '@aiworld/shared/schemas/activity-response.schema';

import { CharacterActivityPage } from '@/activity/domain/activity';
import { mapCommentResponse } from '@/comments/mappers/comment-response.mapper';
import { mapPostWithAuthorResponse } from '@/posts/mappers/post-response.mapper';

export function mapCharacterActivityResponse(
  activity: CharacterActivityPage,
): CharacterActivityResponse {
  return {
    items: activity.items.map((item) => {
      if (item.kind === 'post') {
        return {
          kind: 'post',
          ...mapPostWithAuthorResponse(item.record),
        };
      }
      return {
        kind: 'comment',
        ...mapCommentResponse({
          id: item.record.id,
          author: item.record.author,
          content: item.record.content,
          voteScore: item.record.voteScore,
          createdAt: item.record.createdAt,
          updatedAt: item.record.updatedAt,
          replies: [],
        }),
        postId: item.record.postId,
        postTitle: item.record.postTitle,
      };
    }),
    nextCursor: activity.nextCursor,
  };
}
