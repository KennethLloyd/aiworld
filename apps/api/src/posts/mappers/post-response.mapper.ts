import { CursorPaginated } from '@aiworld/shared/schemas/pagination.schema';
import {
  ListPostsResponse,
  PostDetailResponse,
  PostResponse,
  PostWithAuthorResponse,
} from '@aiworld/shared/schemas/post-response.schema';

import { mapCommentResponse } from '@/comments/mappers/comment-response.mapper';
import {
  FeedPost,
  PostDetail,
  PostItem,
  PostWithAuthor,
} from '@/posts/domain/post';

export function mapPostResponse(post: PostItem): PostResponse {
  return {
    id: post.id,
    title: post.title,
    content: post.content,
    voteScore: post.voteScore,
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
  };
}

export function mapPostWithAuthorResponse(
  post: PostWithAuthor,
): PostWithAuthorResponse {
  return {
    ...mapPostResponse(post),
    author: post.author,
  };
}

export function mapPostDetailResponse(post: PostDetail): PostDetailResponse {
  return {
    ...mapPostWithAuthorResponse(post),
    comments: post.comments.map(mapCommentResponse),
  };
}

export function mapPaginatedPostResponse(
  paginatedPosts: CursorPaginated<FeedPost>,
): ListPostsResponse {
  return {
    items: paginatedPosts.items.map((item) => ({
      ...mapPostWithAuthorResponse(item),
      commentCount: item.commentCount,
    })),
    nextCursor: paginatedPosts.nextCursor,
  };
}
