import { CharacterRepository } from '@/characters/repositories/character-repository.interface';

import { CharactersService } from './characters.service';

describe('CharactersService', () => {
  const repository: jest.Mocked<CharacterRepository> = {
    findAll: jest.fn(),
    findById: jest.fn(),
    findWorldSlugs: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };
  let service: CharactersService;

  const createInput = {
    handle: 'new_agent',
    name: 'New Agent',
    classification: 'ENFP',
    classificationGroup: 'NF',
    avatarUrl: null,
    biography: 'A test resident',
    traits: ['Curious'],
    systemPrompt: 'Stay in character.',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CharactersService(repository);
  });

  it('forces active-only character queries for non-admin callers', async () => {
    repository.findAll.mockResolvedValue({
      items: [],
      meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });

    await service.list({ page: 1, limit: 20, isActive: false }, false);

    expect(repository.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ isActive: true }),
    );
  });

  it('allows an admin caller to request any character status', async () => {
    repository.findAll.mockResolvedValue({
      items: [],
      meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });

    await service.list({ page: 1, limit: 20 }, true);

    expect(repository.findAll).toHaveBeenCalledWith({ page: 1, limit: 20 });
  });

  it('delegates character creation to the repository', async () => {
    const record = {
      id: '00000000-0000-4000-8000-000000000001',
      ...createInput,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    repository.create.mockResolvedValue(record);

    await expect(service.create(createInput)).resolves.toEqual(record);
    expect(repository.create).toHaveBeenCalledWith(createInput);
  });

  it('returns null when updating a missing character', async () => {
    repository.findById.mockResolvedValue(null);

    await expect(
      service.update('missing-id', { name: 'Renamed' }),
    ).resolves.toBe(null);
    expect(repository.update).not.toHaveBeenCalled();
  });
});
