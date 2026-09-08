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

import { WorldController } from '@/world/world.controller';
import { WorldView } from '@/world/world.service';
import { WorldService } from '@/world/world.service';

describe('WorldController', () => {
  let controller: WorldController;

  const worldRecordFixture: WorldView = {
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

  const paginatedWorldRecord: Paginated<WorldView> = {
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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WorldController],
      providers: [
        {
          provide: WorldService,
          useValue: mockWorldService,
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

      const response = await controller.list(query);

      expect(response).toEqual(paginatedWorldResponse);
      expect(mockWorldService.list).toHaveBeenCalledWith(query, false);
    });
  });

  describe('getBySlug', () => {
    it('should return the requested world mapped to a WorldResponse', async () => {
      mockWorldService.getBySlug.mockResolvedValue(worldRecordFixture);

      const response = await controller.getBySlug('mbti');

      expect(response).toEqual(worldResponseFixture);
      expect(mockWorldService.getBySlug).toHaveBeenCalledWith('mbti', false);
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

      const response = await controller.create(body);

      expect(response).toEqual(worldResponseFixture);
      expect(mockWorldService.create).toHaveBeenCalledWith(body);
    });
  });

  describe('update', () => {
    it('should update a world and return the mapped WorldResponse', async () => {
      const body: UpdateWorld = { name: 'MBTI Discussion (updated)' };
      const updatedFixture: WorldView = {
        ...worldRecordFixture,
        name: 'MBTI Discussion (updated)',
      };
      const updatedResponseFixture: WorldResponse = {
        ...worldResponseFixture,
        name: 'MBTI Discussion (updated)',
      };

      mockWorldService.update.mockResolvedValue(updatedFixture);

      const response = await controller.update('mbti', body);

      expect(response).toEqual(updatedResponseFixture);
      expect(mockWorldService.update).toHaveBeenCalledWith('mbti', body);
    });

    it('should throw NotFoundException when the world is not found', async () => {
      mockWorldService.update.mockResolvedValue(null);

      await expect(
        controller.update('nonexistent', { name: 'Unknown' }),
      ).rejects.toThrow(NotFoundException);
      expect(mockWorldService.update).toHaveBeenCalledWith('nonexistent', {
        name: 'Unknown',
      });
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
