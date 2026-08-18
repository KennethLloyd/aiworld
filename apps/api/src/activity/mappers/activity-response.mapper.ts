import { CharacterActivityResponse } from '@aiworld/shared/schemas/activity-response.schema';
import { Injectable } from '@nestjs/common';

import { CharacterActivityPageRecord } from '@/activity/domain/activity-record';
import { CommentResponseMapper } from '@/comments/mappers/comment-response.mapper';
import { PostResponseMapper } from '@/posts/mappers/post-response.mapper';

@Injectable()
export class ActivityResponseMapper {
  constructor(
    private readonly postResponseMapper: PostResponseMapper,
    private readonly commentResponseMapper: CommentResponseMapper,
  ) {}

  mapToCharacterActivityResponse(
    record: CharacterActivityPageRecord,
  ): CharacterActivityResponse {
    return {
      items: record.items.map((item) => {
        if (item.kind === 'post') {
          return {
            kind: 'post',
            ...this.postResponseMapper.mapToPostWithAuthorResponse(item.record),
          };
        }
        return {
          kind: 'comment',
          ...this.commentResponseMapper.mapToCommentResponse({
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
      nextCursor: record.nextCursor,
    };
  }
}
