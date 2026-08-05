import { Paginated } from '@aiworld/shared/schemas/pagination.schema';
import {
  CreateWorld,
  ListWorldsQuery,
  UpdateWorld,
} from '@aiworld/shared/schemas/world.schema';
import { Test, TestingModule } from '@nestjs/testing';

import { WorldRecord } from '@/world/domain/world-record';
import { WorldRepository } from '@/world/repositories/world-repository.interface';

import { WorldService } from './world.service';

describe('WorldService', () => {
  let worldService: WorldService;

  const worldRecordFixture: WorldRecord = {
    id: '00000000-0000-4000-8000-000000000001',
    name: 'MBTI Discussion',
    slug: 'mbti',
    description: { about: 'A community for MBTI enthusiasts' },
    rules: ['Keep discussions civil.', 'Stay on MBTI topic.'],
    topicScope: 'MBTI theory, personality types, cognitive functions',
    isActive: true,
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
    updatedAt: new Date('2026-08-01T00:00:00.000Z'),
  };

  const paginatedFixture: Paginated<WorldRecord> = {
    items: [worldRecordFixture],
    meta: {
      page: 1,
      limit: 10,
      total: 1,
      totalPages: 1,
    },
  };

  const mockRepository: jest.Mocked<WorldRepository> = {
    findAll: jest.fn(),
    findBySlug: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorldService,
        {
          provide: WorldRepository,
          useValue: mockRepository,
        },
      ],
    }).compile();

    worldService = module.get<WorldService>(WorldService);
    jest.clearAllMocks();
  });

  describe('list', () => {
    it('should return the paginated worlds from the repository', async () => {
      const query: ListWorldsQuery = {
        page: 1,
        limit: 10,
      };
      mockRepository.findAll.mockResolvedValue(paginatedFixture);

      const result = await worldService.list(query);

      expect(result).toEqual(paginatedFixture);
      expect(mockRepository.findAll).toHaveBeenCalledWith({
        page: 1,
        limit: 10,
      });
    });

    it('should trim the search term and pass the query without mutating it', async () => {
      const query: ListWorldsQuery = {
        page: 1,
        limit: 10,
        search: '  mbti  ',
      };
      mockRepository.findAll.mockResolvedValue(paginatedFixture);

      await worldService.list(query);

      expect(query).toEqual({
        page: 1,
        limit: 10,
        search: '  mbti  ',
      });
      expect(mockRepository.findAll).toHaveBeenCalledWith({
        page: 1,
        limit: 10,
        search: 'mbti',
      });
    });

    it('should preserve an explicitly provided isActive filter', async () => {
      const query: ListWorldsQuery = {
        page: 1,
        limit: 10,
        isActive: false,
      };
      mockRepository.findAll.mockResolvedValue({
        items: [],
        meta: { page: 1, limit: 10, total: 0, totalPages: 0 },
      });

      await worldService.list(query);

      expect(mockRepository.findAll).toHaveBeenCalledWith({
        page: 1,
        limit: 10,
        isActive: false,
      });
    });
  });

  describe('getBySlug', () => {
    it('should return the world when it exists', async () => {
      mockRepository.findBySlug.mockResolvedValue(worldRecordFixture);

      const result = await worldService.getBySlug('mbti');

      expect(result).toEqual(worldRecordFixture);
      expect(mockRepository.findBySlug).toHaveBeenCalledWith('mbti');
    });

    it('should return null when the world does not exist', async () => {
      mockRepository.findBySlug.mockResolvedValue(null);

      const result = await worldService.getBySlug('nonexistent');

      expect(result).toBeNull();
      expect(mockRepository.findBySlug).toHaveBeenCalledWith('nonexistent');
    });
  });

  describe('create', () => {
    it('should create the world and return the created record', async () => {
      const input: CreateWorld = {
        name: 'MBTI Discussion',
        slug: 'mbti',
        description: { about: 'A community for MBTI enthusiasts' },
        rules: ['Keep discussions civil.', 'Stay on MBTI topic.'],
        topicScope: 'MBTI theory, personality types, cognitive functions',
      };
      mockRepository.create.mockResolvedValue(worldRecordFixture);

      const result = await worldService.create(input);

      expect(result).toEqual(worldRecordFixture);
      expect(mockRepository.create).toHaveBeenCalledWith(input);
    });
  });

  describe('update', () => {
    it('should update the world and return the updated record', async () => {
      const input: UpdateWorld = {
        name: 'MBTI Discussion (updated)',
      };
      const updatedFixture: WorldRecord = {
        ...worldRecordFixture,
        name: 'MBTI Discussion (updated)',
      };
      mockRepository.update.mockResolvedValue(updatedFixture);

      const result = await worldService.update('mbti', input);

      expect(result).toEqual(updatedFixture);
      expect(mockRepository.update).toHaveBeenCalledWith('mbti', input);
    });

    it('should return null when the world does not exist', async () => {
      mockRepository.update.mockResolvedValue(null);

      const result = await worldService.update('nonexistent', {
        name: 'Unknown',
      });

      expect(result).toBeNull();
      expect(mockRepository.update).toHaveBeenCalledWith('nonexistent', {
        name: 'Unknown',
      });
    });
  });

  describe('delete', () => {
    it('should delete the world and resolve void', async () => {
      mockRepository.delete.mockResolvedValue(undefined);

      const result = await worldService.delete('mbti');

      expect(result).toBeUndefined();
      expect(mockRepository.delete).toHaveBeenCalledWith('mbti');
    });
  });
});
