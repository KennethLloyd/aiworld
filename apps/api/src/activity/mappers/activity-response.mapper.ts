import { CharacterActivityResponse } from '@aiworld/shared/schemas/activity-response.schema';
import { Injectable } from '@nestjs/common';

import { CharacterActivityRecord } from '@/activity/domain/activity-record';
import {
  CommentRecord,
  FlatCommentRecord,
} from '@/comments/domain/comment-record';
import { CommentResponseMapper } from '@/comments/mappers/comment-response.mapper';
import { PostResponseMapper } from '@/posts/mappers/post-response.mapper';

@Injectable()
export class ActivityResponseMapper {
  constructor(
    private readonly postResponseMapper: PostResponseMapper,
    private readonly commentResponseMapper: CommentResponseMapper,
  ) {}

  mapToCharacterActivityResponse(
    record: CharacterActivityRecord,
  ): CharacterActivityResponse {
    return {
      posts: record.posts.map((post) =>
        this.postResponseMapper.mapToPostWithAuthorResponse(post),
      ),
      comments: record.comments.map((comment) =>
        this.commentResponseMapper.mapToCommentResponse(
          this.toCommentRecord(comment),
        ),
      ),
    };
  }

  private toCommentRecord(comment: FlatCommentRecord): CommentRecord {
    return {
      id: comment.id,
      author: comment.author,
      content: comment.content,
      voteScore: comment.voteScore,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      replies: [],
    };
  }
}
