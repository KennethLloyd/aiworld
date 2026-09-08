import type { WorldMemberResponse } from '@aiworld/shared/schemas/world-member-response.schema';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';

import {
  createWorldMember,
  listWorldMembers,
  updateWorldMember,
} from './world-member-api';

const member: WorldMemberResponse = {
  id: '6a3f6f47-9a5c-4a0a-bc4d-1c0d9d3b2f10',
  worldId: '7a3f6f47-9a5c-4a0a-bc4d-1c0d9d3b2f11',
  worldSlug: 'mbti-house',
  characterId: '8a3f6f47-9a5c-4a0a-bc4d-1c0d9d3b2f12',
  userId: null,
  role: 'AI',
  isActive: true,
  joinedAt: '2026-07-15T10:00:00.000Z',
};

describe('WorldMember API functions', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function mockFetch(body: unknown, status = 200) {
    const fetchMock = vi.fn<typeof fetch>(async () => {
      return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  it('lists AI memberships with the selected World and pagination query', async () => {
    const fetchMock = mockFetch({
      items: [member],
      meta: { page: 2, limit: 100, total: 101, totalPages: 2 },
    });

    await expect(
      listWorldMembers({
        worldSlug: 'mbti-house',
        role: 'AI',
        page: 2,
        limit: 100,
      }),
    ).resolves.toEqual({
      items: [member],
      meta: { page: 2, limit: 100, total: 101, totalPages: 2 },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/world-members?worldSlug=mbti-house&role=AI&page=2&limit=100',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('serializes assignment and membership activity changes', async () => {
    const fetchMock = mockFetch(member);

    await createWorldMember({
      worldSlug: 'mbti-house',
      characterId: member.characterId!,
      isActive: true,
    });
    await updateWorldMember(member.id, { isActive: false });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/world-members',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          worldSlug: 'mbti-house',
          characterId: member.characterId,
          isActive: true,
        }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      `/api/world-members/${member.id}`,
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ isActive: false }),
      }),
    );
  });

  it('rejects malformed membership responses at the API boundary', async () => {
    mockFetch({ items: [], meta: { page: 1, limit: 20, total: 0 } });

    await expect(
      listWorldMembers({
        worldSlug: 'mbti-house',
        role: 'AI',
        page: 1,
        limit: 20,
      }),
    ).rejects.toBeInstanceOf(ZodError);
  });
});
