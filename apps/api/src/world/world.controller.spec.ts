import { Paginated } from '@aiworld/shared/schemas/pagination.schema';
import {
  ListWorldsResponse,
  WorldResponse,
} from '@aiworld/shared/schemas/world-response.schema';
import {
  CreateWorld,
  ListWorldsQuery,
  UpdateWorld,
} from '@aiworld/shared/schemas/world.schema';
import { NotFoundException } from '@nestjs/common';
import { HTTP_CODE_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';

import { WorldRecord } from '@/world/domain/world-record';
import { WorldResponseMapper } from '@/world/mappers/world-response.mapper';
import { WorldController } from '@/world/world.controller';
import { WorldService } from '@/world/world.service';

describe('WorldController', () => {
  let controller: WorldController;

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
    updatedAt: new Date('2026-08-01T00:00:00.000Z'),
  };

  const paginatedWorldRecord: Paginated<WorldRecord> = {
    items: [worldRecordFixture],
    meta: {
      page: 1,
      limit: 10,
      total: 1,
      totalPages: 1,
    },
  };

  const worldResponseFixture: WorldResponse = {
    ...worldRecordFixture,
    createdAt: worldRecordFixture.createdAt.toISOString(),
    updatedAt: worldRecordFixture.updatedAt.toISOString(),
  };

  const paginatedWorldResponse: ListWorldsResponse = {
    items: [worldResponseFixture],
    meta: {
      page: 1,
      limit: 10,
      total: 1,
      totalPages: 1,
    },
  };

  const mockWorldService: jest.Mocked<
    Pick<WorldService, 'list' | 'getBySlug' | 'create' | 'update' | 'delete'>
  > = {
    list: jest.fn(),
    getBySlug: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };

  const mockWorldResponseMapper: jest.Mocked<WorldResponseMapper> = {
    mapToWorldResponse: jest.fn(),
    mapToPaginatedWorldResponse: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WorldController],
      providers: [
        {
          provide: WorldService,
          useValue: mockWorldService,
        },
        {
          provide: WorldResponseMapper,
          useValue: mockWorldResponseMapper,
        },
      ],
    }).compile();

    controller = module.get<WorldController>(WorldController);
    jest.clearAllMocks();
  });

  describe('list', () => {
    it('should delegate to the service and return the mapped paginated response', async () => {
      const query: ListWorldsQuery = {
        page: 1,
        limit: 10,
      };

      mockWorldService.list.mockResolvedValue(paginatedWorldRecord);
      mockWorldResponseMapper.mapToPaginatedWorldResponse.mockReturnValue(
        paginatedWorldResponse,
      );

      const response = await controller.list(query);

      expect(response).toEqual(paginatedWorldResponse);
      expect(mockWorldService.list).toHaveBeenCalledWith(query, false);
      expect(
        mockWorldResponseMapper.mapToPaginatedWorldResponse,
      ).toHaveBeenCalledWith(paginatedWorldRecord);
    });
  });

  describe('getBySlug', () => {
    it('should return the requested world mapped to a WorldResponse', async () => {
      mockWorldService.getBySlug.mockResolvedValue(worldRecordFixture);
      mockWorldResponseMapper.mapToWorldResponse.mockReturnValue(
        worldResponseFixture,
      );

      const response = await controller.getBySlug('mbti');

      expect(response).toEqual(worldResponseFixture);
      expect(mockWorldService.getBySlug).toHaveBeenCalledWith('mbti', false);
      expect(mockWorldResponseMapper.mapToWorldResponse).toHaveBeenCalledWith(
        worldRecordFixture,
      );
    });

    it('should throw NotFoundException when the world is not found', async () => {
      mockWorldService.getBySlug.mockResolvedValue(null);

      await expect(controller.getBySlug('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockWorldService.getBySlug).toHaveBeenCalledWith(
        'nonexistent',
        false,
      );
      expect(mockWorldResponseMapper.mapToWorldResponse).not.toHaveBeenCalled();
    });
  });

  describe('create', () => {
    it('should create a world and return the mapped WorldResponse', async () => {
      const body: CreateWorld = {
        name: 'MBTI Discussion',
        slug: 'mbti',
        description: { about: 'A community for MBTI enthusiasts' },
        rules: ['Keep discussions civil.', 'Stay on MBTI topic.'],
        topicScope: 'MBTI theory, personality types, cognitive functions',
      };

      mockWorldService.create.mockResolvedValue(worldRecordFixture);
      mockWorldResponseMapper.mapToWorldResponse.mockReturnValue(
        worldResponseFixture,
      );

      const response = await controller.create(body);

      expect(response).toEqual(worldResponseFixture);
      expect(mockWorldService.create).toHaveBeenCalledWith(body);
      expect(mockWorldResponseMapper.mapToWorldResponse).toHaveBeenCalledWith(
        worldRecordFixture,
      );
    });
  });

  describe('update', () => {
    it('should update a world and return the mapped WorldResponse', async () => {
      const body: UpdateWorld = { name: 'MBTI Discussion (updated)' };
      const updatedFixture: WorldRecord = {
        ...worldRecordFixture,
        name: 'MBTI Discussion (updated)',
      };
      const updatedResponseFixture: WorldResponse = {
        ...worldResponseFixture,
        name: 'MBTI Discussion (updated)',
      };

      mockWorldService.update.mockResolvedValue(updatedFixture);
      mockWorldResponseMapper.mapToWorldResponse.mockReturnValue(
        updatedResponseFixture,
      );

      const response = await controller.update('mbti', body);

      expect(response).toEqual(updatedResponseFixture);
      expect(mockWorldService.update).toHaveBeenCalledWith('mbti', body);
      expect(mockWorldResponseMapper.mapToWorldResponse).toHaveBeenCalledWith(
        updatedFixture,
      );
    });

    it('should throw NotFoundException when the world is not found', async () => {
      mockWorldService.update.mockResolvedValue(null);

      await expect(
        controller.update('nonexistent', { name: 'Unknown' }),
      ).rejects.toThrow(NotFoundException);
      expect(mockWorldService.update).toHaveBeenCalledWith('nonexistent', {
        name: 'Unknown',
      });
      expect(mockWorldResponseMapper.mapToWorldResponse).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('should delete the world after verifying it exists', async () => {
      mockWorldService.getBySlug.mockResolvedValue(worldRecordFixture);
      mockWorldService.delete.mockResolvedValue(undefined);

      await expect(controller.delete('mbti')).resolves.toBeUndefined();
      expect(mockWorldService.getBySlug).toHaveBeenCalledWith('mbti', true);
      expect(mockWorldService.delete).toHaveBeenCalledWith('mbti');
    });

    it('should throw NotFoundException when the world does not exist', async () => {
      mockWorldService.getBySlug.mockResolvedValue(null);

      await expect(controller.delete('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
      expect(mockWorldService.getBySlug).toHaveBeenCalledWith(
        'nonexistent',
        true,
      );
      expect(mockWorldService.delete).not.toHaveBeenCalled();
    });

    it('should carry explicit HTTP 204 metadata', () => {
      const reflector = new Reflector();

      expect(reflector.get<number>(HTTP_CODE_METADATA, controller.delete)).toBe(
        204,
      );
    });
  });

  describe('roles metadata', () => {
    const reflector = new Reflector();

    it('should require ADMIN role on create', () => {
      expect(reflector.get<string[]>('ROLES', controller.create)).toEqual([
        'ADMIN',
      ]);
    });

    it('should require ADMIN role on update', () => {
      expect(reflector.get<string[]>('ROLES', controller.update)).toEqual([
        'ADMIN',
      ]);
    });

    it('should require ADMIN role on delete', () => {
      expect(reflector.get<string[]>('ROLES', controller.delete)).toEqual([
        'ADMIN',
      ]);
    });
  });
});
