import { Paginated } from '@aiworld/shared/schemas/pagination.schema';
import {
  ListPostsResponse,
  PostDetailResponse,
  PostResponse,
  PostWithAuthorResponse,
} from '@aiworld/shared/schemas/post-response.schema';
import { Injectable } from '@nestjs/common';

import { CommentResponseMapper } from '@/comments/mappers/comment-response.mapper';
import {
  PostDetailRecord,
  PostRecord,
  PostWithAuthorRecord,
} from '@/posts/domain/post-record';

@Injectable()
export class PostResponseMapper {
  constructor(private readonly commentResponseMapper: CommentResponseMapper) {}

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

  mapToPostWithAuthorResponse(
    record: PostWithAuthorRecord,
  ): PostWithAuthorResponse {
    return {
      ...this.mapToPostResponse(record),
      author: record.author,
    };
  }

  mapToPostDetailResponse(record: PostDetailRecord): PostDetailResponse {
    return {
      ...this.mapToPostWithAuthorResponse(record),
      comments: record.comments.map((comment) =>
        this.commentResponseMapper.mapToCommentResponse(comment),
      ),
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
