import { Paginated } from '@aiworld/shared/schemas/pagination.schema';
import { SearchResponse } from '@aiworld/shared/schemas/search-response.schema';
import { SearchQuery } from '@aiworld/shared/schemas/search.schema';
import { NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';

import { PostWithAuthorRecord } from '@/posts/domain/post-record';
import { SearchResultRecord } from '@/search/domain/search-record';
import { SearchResponseMapper } from '@/search/mappers/search-response.mapper';
import { SearchController } from '@/search/search.controller';
import { SearchService } from '@/search/search.service';

describe('SearchController', () => {
  let controller: SearchController;

  const postRecordFixture: PostWithAuthorRecord = {
    id: '00000000-0000-4000-8000-000000000001',
    title: 'Who actually uses the microwave for FISH?',
    content: 'It smells like low tide.',
    voteScore: 5,
    author: null,
    createdAt: new Date('2026-08-06T08:00:00.000Z'),
    updatedAt: new Date('2026-08-06T08:00:00.000Z'),
  };

  const resultsFixture: Paginated<SearchResultRecord> = {
    items: [{ type: 'post', post: postRecordFixture }],
    meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
  };

  const searchResponseFixture: SearchResponse = {
    items: [
      {
        type: 'post',
        post: {
          id: postRecordFixture.id,
          title: postRecordFixture.title,
          content: postRecordFixture.content,
          voteScore: postRecordFixture.voteScore,
          author: null,
          createdAt: postRecordFixture.createdAt.toISOString(),
          updatedAt: postRecordFixture.updatedAt.toISOString(),
        },
      },
    ],
    meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
  };

  const queryFixture: SearchQuery = { q: 'quillfox', page: 1, limit: 20 };

  const mockSearchService: jest.Mocked<Pick<SearchService, 'search'>> = {
    search: jest.fn(),
  };

  const mockSearchResponseMapper: jest.Mocked<
    Pick<SearchResponseMapper, 'mapToSearchResponse'>
  > = {
    mapToSearchResponse: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SearchController],
      providers: [
        { provide: SearchService, useValue: mockSearchService },
        { provide: SearchResponseMapper, useValue: mockSearchResponseMapper },
      ],
    }).compile();

    controller = module.get<SearchController>(SearchController);
    jest.clearAllMocks();
  });

  it('should return the mapped search response', async () => {
    mockSearchService.search.mockResolvedValue(resultsFixture);
    mockSearchResponseMapper.mapToSearchResponse.mockReturnValue(
      searchResponseFixture,
    );

    const response = await controller.search('mbti-house', queryFixture);

    expect(response).toEqual(searchResponseFixture);
    expect(mockSearchService.search).toHaveBeenCalledWith(
      'mbti-house',
      queryFixture,
    );
    expect(mockSearchResponseMapper.mapToSearchResponse).toHaveBeenCalledWith(
      resultsFixture,
    );
  });

  it('should throw NotFoundException when the world does not exist', async () => {
    mockSearchService.search.mockResolvedValue(null);

    await expect(
      controller.search('missing-world', queryFixture),
    ).rejects.toThrow(NotFoundException);
    expect(mockSearchService.search).toHaveBeenCalledWith(
      'missing-world',
      queryFixture,
    );
    expect(mockSearchResponseMapper.mapToSearchResponse).not.toHaveBeenCalled();
  });

  it('should be publicly accessible without a session', () => {
    const reflector = new Reflector();

    expect(reflector.get<boolean>('PUBLIC', controller.search)).toBe(true);
  });
});
