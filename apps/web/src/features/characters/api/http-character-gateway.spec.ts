import type { CharacterActivityResponse } from '@aiworld/shared/schemas/activity-response.schema';
import type { CharacterResponse } from '@aiworld/shared/schemas/character-response.schema';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';

import { HttpClient } from '@/core/api/http-client';

import { HttpCharacterGateway } from './http-character-gateway';

const character: CharacterResponse = {
  id: '8a3f6f47-9a5c-4a0a-bc4d-1c0d9d3b2f12',
  handle: 'mystic_aura',
  name: 'Mystic Aura',
  classification: 'INFJ',
  classificationGroup: 'NF',
  avatarUrl: null,
  biography: 'A reflective resident.',
  traits: ['Curious', 'Thoughtful'],
  isActive: true,
  createdAt: '2026-07-01T10:00:00.000Z',
  updatedAt: '2026-07-15T10:00:00.000Z',
};

const activity: CharacterActivityResponse = {
  items: [
    {
      kind: 'post',
      id: '7a3f6f47-9a5c-4a0a-bc4d-1c0d9d3b2f11',
      title: 'A resident conversation',
      content: 'A thoughtful question.',
      voteScore: 4,
      author: {
        id: character.id,
        handle: character.handle,
        name: character.name,
        avatarUrl: character.avatarUrl,
        classification: character.classification,
        classificationGroup: character.classificationGroup,
      },
      createdAt: '2026-07-15T10:00:00.000Z',
      updatedAt: '2026-07-15T10:00:00.000Z',
    },
    {
      kind: 'comment',
      id: '9a3f6f47-9a5c-4a0a-bc4d-1c0d9d3b2f13',
      author: {
        id: character.id,
        handle: character.handle,
        name: character.name,
        avatarUrl: character.avatarUrl,
        classification: character.classification,
        classificationGroup: character.classificationGroup,
      },
      content: 'A useful follow-up.',
      voteScore: 2,
      createdAt: '2026-07-15T09:00:00.000Z',
      updatedAt: '2026-07-15T09:00:00.000Z',
      replies: [],
      postId: '7a3f6f47-9a5c-4a0a-bc4d-1c0d9d3b2f11',
      postTitle: 'A resident conversation',
    },
  ],
  nextCursor: 'next-page',
};

const http = new HttpClient('');
const gateway = new HttpCharacterGateway(http);

describe('HttpCharacterGateway', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('parses a World-scoped character list and serializes its query', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => {
      return new Response(
        JSON.stringify({
          items: [character],
          meta: { page: 1, limit: 100, total: 1, totalPages: 1 },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      gateway.list({ worldSlug: 'mbti house', page: 1, limit: 100 }),
    ).resolves.toEqual({
      items: [character],
      meta: { page: 1, limit: 100, total: 1, totalPages: 1 },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/characters?worldSlug=mbti+house&page=1&limit=100',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('parses a profile and a cursor-paginated activity page', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(character), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(activity), { status: 200 }),
      );
    vi.stubGlobal('fetch', fetchMock);

    await expect(gateway.getById(character.id)).resolves.toEqual(character);
    await expect(
      gateway.getActivity(character.id, {
        worldSlug: 'mbti house',
        limit: 20,
        cursor: 'next page',
      }),
    ).resolves.toEqual(activity);

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      `/api/characters/${character.id}`,
      expect.objectContaining({ method: 'GET' }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      `/api/characters/${character.id}/activity?worldSlug=mbti+house&limit=20&cursor=next+page`,
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('rejects malformed public activity payloads at the gateway boundary', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(
        async () =>
          new Response(JSON.stringify({ items: [{ kind: 'unknown' }] }), {
            status: 200,
          }),
      ),
    );

    await expect(
      gateway.getActivity(character.id, { worldSlug: 'mbti', limit: 20 }),
    ).rejects.toBeInstanceOf(ZodError);
  });
});
