import { CursorPaginated } from '@aiworld/shared/schemas/pagination.schema';
import { ListPostsResponse } from '@aiworld/shared/schemas/post-response.schema';
import { PostDetailResponse } from '@aiworld/shared/schemas/post-response.schema';
import { ListPostsQuery } from '@aiworld/shared/schemas/post.schema';
import { NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';

import { Comment } from '@/comments/domain/comment';
import { FeedPost, PostItem } from '@/posts/domain/post';
import { PostsController } from '@/posts/posts.controller';
import { PostsService } from '@/posts/posts.service';

describe('PostsController', () => {
  let controller: PostsController;

  const postRecordFixture: PostItem = {
    id: '00000000-0000-4000-8000-000000000001',
    title: 'Who actually uses the microwave for FISH?',
    content: 'It smells like low tide.',
    voteScore: 5,
    createdAt: new Date('2026-08-06T08:00:00.000Z'),
    updatedAt: new Date('2026-08-06T08:00:00.000Z'),
  };

  const authorFixture = {
    id: '00000000-0000-4000-8000-000000000101',
    handle: 'standard_procedure',
    name: 'Standard_Procedure',
    avatarUrl: null,
  };

  const postDetailRecordFixture = {
    ...postRecordFixture,
    author: authorFixture,
    comments: [
      {
        id: '00000000-0000-4000-8000-000000000201',
        author: authorFixture,
        content: 'It was me. I said it.',
        voteScore: 2,
        createdAt: new Date('2026-08-06T09:00:00.000Z'),
        updatedAt: new Date('2026-08-06T09:00:00.000Z'),
        replies: [] as Comment[],
      },
    ],
  };

  const paginatedPostRecords: CursorPaginated<FeedPost> = {
    items: [
      {
        ...postRecordFixture,
        author: authorFixture,
        commentCount: 2,
      },
    ],
    nextCursor: null,
  };

  const paginatedPostResponse: ListPostsResponse = {
    items: [
      {
        ...postRecordFixture,
        author: authorFixture,
        commentCount: 2,
        createdAt: postRecordFixture.createdAt.toISOString(),
        updatedAt: postRecordFixture.updatedAt.toISOString(),
      },
    ],
    nextCursor: null,
  };

  const postDetailResponse: PostDetailResponse = {
    id: postDetailRecordFixture.id,
    title: postDetailRecordFixture.title,
    content: postDetailRecordFixture.content,
    voteScore: postDetailRecordFixture.voteScore,
    createdAt: postDetailRecordFixture.createdAt.toISOString(),
    updatedAt: postDetailRecordFixture.updatedAt.toISOString(),
    author: postDetailRecordFixture.author,
    comments: [
      {
        id: postDetailRecordFixture.comments[0].id,
        author: postDetailRecordFixture.comments[0].author,
        content: postDetailRecordFixture.comments[0].content,
        voteScore: postDetailRecordFixture.comments[0].voteScore,
        createdAt: '2026-08-06T09:00:00.000Z',
        updatedAt: '2026-08-06T09:00:00.000Z',
        replies: [],
      },
    ],
  };

  const queryFixture: ListPostsQuery = { sort: 'hot', limit: 20 };

  const mockPostsService: jest.Mocked<
    Pick<PostsService, 'findFeed' | 'findByWorldSlug'>
  > = {
    findFeed: jest.fn(),
    findByWorldSlug: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PostsController],
      providers: [{ provide: PostsService, useValue: mockPostsService }],
    }).compile();

    controller = module.get<PostsController>(PostsController);
    jest.clearAllMocks();
  });

  describe('list', () => {
    it('should return the mapped paginated feed', async () => {
      mockPostsService.findFeed.mockResolvedValue(paginatedPostRecords);

      const response = await controller.list('mbti-house', queryFixture);

      expect(response).toEqual(paginatedPostResponse);
      expect(mockPostsService.findFeed).toHaveBeenCalledWith(
        'mbti-house',
        queryFixture,
      );
    });

    it('should throw NotFoundException when the world does not exist', async () => {
      mockPostsService.findFeed.mockResolvedValue(null);

      await expect(
        controller.list('missing-world', queryFixture),
      ).rejects.toThrow(NotFoundException);
      expect(mockPostsService.findFeed).toHaveBeenCalledWith(
        'missing-world',
        queryFixture,
      );
    });
  });

  describe('getById', () => {
    it('should return the mapped post detail', async () => {
      mockPostsService.findByWorldSlug.mockResolvedValue(
        postDetailRecordFixture,
      );

      const response = await controller.getById({
        slug: 'mbti-house',
        postId: postDetailRecordFixture.id,
      });

      expect(response).toEqual(postDetailResponse);
      expect(mockPostsService.findByWorldSlug).toHaveBeenCalledWith(
        'mbti-house',
        postDetailRecordFixture.id,
      );
    });

    it('should throw NotFoundException when the post is missing', async () => {
      mockPostsService.findByWorldSlug.mockResolvedValue(null);

      await expect(
        controller.getById({ slug: 'mbti-house', postId: 'missing-post' }),
      ).rejects.toThrow(NotFoundException);
      expect(mockPostsService.findByWorldSlug).toHaveBeenCalledWith(
        'mbti-house',
        'missing-post',
      );
    });
  });

  describe('access metadata', () => {
    const reflector = new Reflector();

    it('should be publicly accessible without a session', () => {
      expect(reflector.get<boolean>('PUBLIC', controller.list)).toBe(true);
      expect(reflector.get<boolean>('PUBLIC', controller.getById)).toBe(true);
    });
  });
});
