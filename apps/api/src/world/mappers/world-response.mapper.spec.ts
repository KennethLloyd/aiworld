import { Paginated } from '@aiworld/shared/schemas/pagination.schema';
import {
  ListWorldsResponse,
  WorldResponse,
} from '@aiworld/shared/schemas/world-response.schema';
import { Test, TestingModule } from '@nestjs/testing';

import { WorldRecord } from '@/world/domain/world-record';

import { WorldResponseMapper } from './world-response.mapper';

describe('WorldResponseMapper', () => {
  let mapper: WorldResponseMapper;

  const worldRecordFixture: WorldRecord = {
    id: '00000000-0000-4000-8000-000000000001',
    name: 'MBTI Discussion',
    slug: 'mbti',
    description: { about: 'A community for MBTI enthusiasts' },
    rules: ['Keep discussions civil.', 'Stay on MBTI topic.'],
    topicScope: 'MBTI theory, personality types, cognitive functions',
    residentCount: 16,
    isActive: true,
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
    updatedAt: new Date('2026-08-02T12:30:45.123Z'),
  };

  const worldResponseFixture: WorldResponse = {
    ...worldRecordFixture,
    createdAt: worldRecordFixture.createdAt.toISOString(),
    updatedAt: worldRecordFixture.updatedAt.toISOString(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [WorldResponseMapper],
    }).compile();

    mapper = module.get<WorldResponseMapper>(WorldResponseMapper);
  });

  describe('mapToWorldResponse', () => {
    it('should convert a WorldRecord to a WorldResponse with ISO date strings', () => {
      const result = mapper.mapToWorldResponse(worldRecordFixture);

      expect(result).toEqual(worldResponseFixture);
      expect(result.createdAt).toBe('2026-08-01T00:00:00.000Z');
      expect(result.updatedAt).toBe('2026-08-02T12:30:45.123Z');
    });

    it('should preserve the non-date fields unchanged', () => {
      const result = mapper.mapToWorldResponse(worldRecordFixture);

      expect(result.id).toBe(worldRecordFixture.id);
      expect(result.name).toBe(worldRecordFixture.name);
      expect(result.slug).toBe(worldRecordFixture.slug);
      expect(result.description).toEqual(worldRecordFixture.description);
      expect(result.rules).toEqual(worldRecordFixture.rules);
      expect(result.topicScope).toBe(worldRecordFixture.topicScope);
      expect(result.isActive).toBe(worldRecordFixture.isActive);
    });
  });

  describe('mapToPaginatedWorldResponse', () => {
    it('should map each item and preserve the pagination metadata', () => {
      const paginatedRecords: Paginated<WorldRecord> = {
        items: [worldRecordFixture],
        meta: {
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1,
        },
      };

      const expected: ListWorldsResponse = {
        items: [worldResponseFixture],
        meta: {
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1,
        },
      };

      const result = mapper.mapToPaginatedWorldResponse(paginatedRecords);

      expect(result).toEqual(expected);
      expect(result.items[0].createdAt).toBe('2026-08-01T00:00:00.000Z');
      expect(result.items[0].updatedAt).toBe('2026-08-02T12:30:45.123Z');
    });

    it('should handle an empty items array with metadata intact', () => {
      const paginatedRecords: Paginated<WorldRecord> = {
        items: [],
        meta: {
          page: 1,
          limit: 20,
          total: 0,
          totalPages: 0,
        },
      };

      const result = mapper.mapToPaginatedWorldResponse(paginatedRecords);

      expect(result).toEqual({
        items: [],
        meta: {
          page: 1,
          limit: 20,
          total: 0,
          totalPages: 0,
        },
      });
    });
  });
});
