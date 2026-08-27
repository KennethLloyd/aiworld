import { CursorPaginated } from '@aiworld/shared/schemas/pagination.schema';
import { ListPostsQuery } from '@aiworld/shared/schemas/post.schema';
import { BadRequestException, Injectable } from '@nestjs/common';

import { buildCommentTree } from '@/comments/domain/comment-tree';
import { CommentRepository } from '@/comments/repositories/comment-repository.interface';
import { parsePostFeedCursor } from '@/posts/domain/post-feed-cursor';
import { PostDetailRecord, PostFeedRecord } from '@/posts/domain/post-record';
import { PostRepository } from '@/posts/repositories/post-repository.interface';
import { WorldService } from '@/world/world.service';

@Injectable()
export class PostsService {
  constructor(
    private readonly worldService: WorldService,
    private readonly postRepository: PostRepository,
    private readonly commentRepository: CommentRepository,
  ) {}

  async findFeed(
    worldSlug: string,
    query: ListPostsQuery,
  ): Promise<CursorPaginated<PostFeedRecord> | null> {
    const world = await this.worldService.getBySlug(worldSlug, false);
    if (!world) {
      return null;
    }

    const parsedCursor = parsePostFeedCursor(query.cursor, query.sort);
    if (!parsedCursor.ok) {
      throw new BadRequestException({
        statusCode: 400,
        message: [
          { code: 'custom', path: ['cursor'], message: 'Invalid cursor.' },
        ],
        error: 'Validation Failed',
      });
    }

    return this.postRepository.findFeed(world.id, {
      sort: query.sort,
      limit: query.limit,
      cursor: parsedCursor.cursor,
    });
  }

  async findById(
    worldSlug: string,
    postId: string,
  ): Promise<PostDetailRecord | null> {
    const world = await this.worldService.getBySlug(worldSlug, false);
    if (!world) {
      return null;
    }

    const post = await this.postRepository.findById(world.id, postId);
    if (!post) {
      return null;
    }

    const comments = await this.commentRepository.findByPostId(post.id);

    return {
      ...post,
      comments: buildCommentTree(comments),
    };
  }
}
