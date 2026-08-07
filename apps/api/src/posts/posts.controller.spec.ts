import { Paginated } from '@aiworld/shared/schemas/pagination.schema';
import { ListPostsResponse } from '@aiworld/shared/schemas/post-response.schema';
import { PostDetailResponse } from '@aiworld/shared/schemas/post-response.schema';
import { ListPostsQuery } from '@aiworld/shared/schemas/post.schema';
import { NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';

import { CommentRecord } from '@/comments/domain/comment-record';
import { PostRecord } from '@/posts/domain/post-record';
import { PostResponseMapper } from '@/posts/mappers/post-response.mapper';
import { PostsController } from '@/posts/posts.controller';
import { PostsService } from '@/posts/posts.service';

describe('PostsController', () => {
  let controller: PostsController;

  const postRecordFixture: PostRecord = {
    id: '00000000-0000-4000-8000-000000000001',
    title: 'Who actually uses the microwave for FISH?',
    content: 'It smells like low tide.',
    voteScore: 5,
    createdAt: new Date('2026-08-06T08:00:00.000Z'),
    updatedAt: new Date('2026-08-06T08:00:00.000Z'),
  };

  const postDetailRecordFixture = {
    ...postRecordFixture,
    author: {
      id: '00000000-0000-4000-8000-000000000101',
      handle: 'standard_procedure',
      name: 'Standard_Procedure',
      avatarUrl: null,
    },
    comments: [
      {
        id: '00000000-0000-4000-8000-000000000201',
        author: null,
        content: 'It was me. I said it.',
        voteScore: 2,
        createdAt: new Date('2026-08-06T09:00:00.000Z'),
        updatedAt: new Date('2026-08-06T09:00:00.000Z'),
        replies: [] as CommentRecord[],
      },
    ],
  };

  const paginatedPostRecords: Paginated<PostRecord> = {
    items: [postRecordFixture],
    meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
  };

  const paginatedPostResponse: ListPostsResponse = {
    items: [
      {
        ...postRecordFixture,
        createdAt: postRecordFixture.createdAt.toISOString(),
        updatedAt: postRecordFixture.updatedAt.toISOString(),
      },
    ],
    meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
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

  const queryFixture: ListPostsQuery = { sort: 'hot', page: 1, limit: 20 };

  const mockPostsService: jest.Mocked<
    Pick<PostsService, 'findFeed' | 'findById'>
  > = {
    findFeed: jest.fn(),
    findById: jest.fn(),
  };

  const mockPostResponseMapper: jest.Mocked<
    Pick<
      PostResponseMapper,
      | 'mapToPostResponse'
      | 'mapToPostWithAuthorResponse'
      | 'mapToPostDetailResponse'
      | 'mapToPaginatedPostResponse'
    >
  > = {
    mapToPostResponse: jest.fn(),
    mapToPostWithAuthorResponse: jest.fn(),
    mapToPostDetailResponse: jest.fn(),
    mapToPaginatedPostResponse: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PostsController],
      providers: [
        { provide: PostsService, useValue: mockPostsService },
        { provide: PostResponseMapper, useValue: mockPostResponseMapper },
      ],
    }).compile();

    controller = module.get<PostsController>(PostsController);
    jest.clearAllMocks();
  });

  describe('list', () => {
    it('should return the mapped paginated feed', async () => {
      mockPostsService.findFeed.mockResolvedValue(paginatedPostRecords);
      mockPostResponseMapper.mapToPaginatedPostResponse.mockReturnValue(
        paginatedPostResponse,
      );

      const response = await controller.list('mbti-house', queryFixture);

      expect(response).toEqual(paginatedPostResponse);
      expect(mockPostsService.findFeed).toHaveBeenCalledWith(
        'mbti-house',
        queryFixture,
      );
      expect(
        mockPostResponseMapper.mapToPaginatedPostResponse,
      ).toHaveBeenCalledWith(paginatedPostRecords);
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
      expect(
        mockPostResponseMapper.mapToPaginatedPostResponse,
      ).not.toHaveBeenCalled();
    });
  });

  describe('getById', () => {
    it('should return the mapped post detail', async () => {
      mockPostsService.findById.mockResolvedValue(postDetailRecordFixture);
      mockPostResponseMapper.mapToPostDetailResponse.mockReturnValue(
        postDetailResponse,
      );

      const response = await controller.getById({
        slug: 'mbti-house',
        postId: postDetailRecordFixture.id,
      });

      expect(response).toEqual(postDetailResponse);
      expect(mockPostsService.findById).toHaveBeenCalledWith(
        'mbti-house',
        postDetailRecordFixture.id,
      );
      expect(
        mockPostResponseMapper.mapToPostDetailResponse,
      ).toHaveBeenCalledWith(postDetailRecordFixture);
    });

    it('should throw NotFoundException when the post is missing', async () => {
      mockPostsService.findById.mockResolvedValue(null);

      await expect(
        controller.getById({ slug: 'mbti-house', postId: 'missing-post' }),
      ).rejects.toThrow(NotFoundException);
      expect(mockPostsService.findById).toHaveBeenCalledWith(
        'mbti-house',
        'missing-post',
      );
      expect(
        mockPostResponseMapper.mapToPostDetailResponse,
      ).not.toHaveBeenCalled();
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
