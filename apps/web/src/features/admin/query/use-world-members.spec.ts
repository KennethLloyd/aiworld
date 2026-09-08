import type { WorldMemberResponse } from '@aiworld/shared/schemas/world-member-response.schema';
import { describe, expect, it, vi } from 'vitest';

import { listWorldMembers } from '@/features/admin/api/world-member-api';
import { listAdminCharacters } from '@/features/characters/api/character-api';
import { listAllAdminCharacters } from '@/features/characters/query/use-admin-characters';

import { listAllAiWorldMembers } from './use-world-members';

vi.mock('@/features/admin/api/world-member-api', () => ({
  listWorldMembers: vi.fn<typeof listWorldMembers>(),
}));
vi.mock('@/features/characters/api/character-api', () => ({
  listAdminCharacters: vi.fn<typeof listAdminCharacters>(),
}));

const firstMember = makeMember('6a3f6f47-9a5c-4a0a-bc4d-1c0d9d3b2f10');
const secondMember = makeMember('7a3f6f47-9a5c-4a0a-bc4d-1c0d9d3b2f11');

describe('WorldMember query boundaries', () => {
  it('loads every AI membership page before candidate filtering can begin', async () => {
    const list = vi
      .fn<typeof listWorldMembers>()
      .mockResolvedValueOnce({
        items: [firstMember],
        meta: { page: 1, limit: 100, total: 2, totalPages: 2 },
      })
      .mockResolvedValueOnce({
        items: [secondMember],
        meta: { page: 2, limit: 100, total: 2, totalPages: 2 },
      });

    vi.mocked(listWorldMembers).mockImplementation(list);

    await expect(listAllAiWorldMembers('mbti-house')).resolves.toEqual([
      firstMember,
      secondMember,
    ]);
    expect(list).toHaveBeenNthCalledWith(1, {
      worldSlug: 'mbti-house',
      role: 'AI',
      page: 1,
      limit: 100,
    });
    expect(list).toHaveBeenNthCalledWith(2, {
      worldSlug: 'mbti-house',
      role: 'AI',
      page: 2,
      limit: 100,
    });
  });

  it('loads every Character registry page for complete identity joins', async () => {
    const firstCharacter = makeCharacter(
      '8a3f6f47-9a5c-4a0a-bc4d-1c0d9d3b2f12',
    );
    const secondCharacter = makeCharacter(
      '9a3f6f47-9a5c-4a0a-bc4d-1c0d9d3b2f13',
    );
    const listAdmin = vi
      .fn<typeof listAdminCharacters>()
      .mockResolvedValueOnce({
        items: [firstCharacter],
        meta: { page: 1, limit: 100, total: 2, totalPages: 2 },
      })
      .mockResolvedValueOnce({
        items: [secondCharacter],
        meta: { page: 2, limit: 100, total: 2, totalPages: 2 },
      });

    vi.mocked(listAdminCharacters).mockImplementation(listAdmin);

    await expect(listAllAdminCharacters()).resolves.toEqual([
      firstCharacter,
      secondCharacter,
    ]);
    expect(listAdmin).toHaveBeenNthCalledWith(2, { page: 2, limit: 100 });
  });
});

function makeMember(id: string): WorldMemberResponse {
  return {
    id,
    worldId: 'aa3f6f47-9a5c-4a0a-bc4d-1c0d9d3b2f14',
    worldSlug: 'mbti-house',
    characterId: id,
    userId: null,
    role: 'AI',
    isActive: true,
    joinedAt: '2026-07-15T10:00:00.000Z',
  };
}

function makeCharacter(id: string) {
  return {
    id,
    handle: 'test_character',
    name: 'Test Character',
    classification: null,
    classificationGroup: null,
    avatarUrl: null,
    biography: 'A test Character.',
    traits: [],
    isActive: true,
    createdAt: '2026-07-01T10:00:00.000Z',
    updatedAt: '2026-07-15T10:00:00.000Z',
    systemPrompt: 'You are a test Character.',
  };
}
