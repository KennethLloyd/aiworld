import { BadRequestException } from '@nestjs/common';

import { CharacterRepository } from '@/characters/repositories/character-repository.interface';
import { WorldMemberRepository } from '@/world-members/repositories/world-member-repository.interface';

import { WorldMembersService } from './world-members.service';

describe('WorldMembersService', () => {
  const worldMemberRepository: jest.Mocked<WorldMemberRepository> = {
    findAll: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };
  const characterRepository: jest.Mocked<CharacterRepository> = {
    findAll: jest.fn(),
    findById: jest.fn(),
    findWorldSlugs: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };
  let service: WorldMembersService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new WorldMembersService(
      worldMemberRepository,
      characterRepository,
    );
  });

  it('validates an AI character before adding it to mbti-house', async () => {
    characterRepository.findById.mockResolvedValue({
      id: '00000000-0000-4000-8000-000000000001',
      handle: 'invalid_agent',
      name: 'Invalid Agent',
      classification: 'ENFP',
      classificationGroup: 'NT',
      avatarUrl: null,
      biography: 'A test resident',
      traits: ['Curious'],
      systemPrompt: 'Stay in character.',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(
      service.create({
        worldSlug: 'mbti-house',
        characterId: '00000000-0000-4000-8000-000000000001',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(worldMemberRepository.create).not.toHaveBeenCalled();
  });

  it('delegates membership activation changes to the repository', async () => {
    worldMemberRepository.update.mockResolvedValue(null);

    await service.update('00000000-0000-4000-8000-000000000001', {
      isActive: false,
    });

    expect(worldMemberRepository.update).toHaveBeenCalledWith(
      '00000000-0000-4000-8000-000000000001',
      { isActive: false },
    );
  });
});
