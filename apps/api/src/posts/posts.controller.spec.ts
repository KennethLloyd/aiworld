import { Paginated } from '@aiworld/shared/schemas/pagination.schema';
import { ListPostsResponse } from '@aiworld/shared/schemas/post-response.schema';
import { ListPostsQuery } from '@aiworld/shared/schemas/post.schema';
import { NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';

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

  const queryFixture: ListPostsQuery = { sort: 'hot', page: 1, limit: 20 };

  const mockPostsService: jest.Mocked<Pick<PostsService, 'findFeed'>> = {
    findFeed: jest.fn(),
  };

  const mockPostResponseMapper: jest.Mocked<PostResponseMapper> = {
    mapToPostResponse: jest.fn(),
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

  describe('access metadata', () => {
    const reflector = new Reflector();

    it('should be publicly accessible without a session', () => {
      expect(reflector.get<boolean>('PUBLIC', controller.list)).toBe(true);
    });
  });
});
