import type { SearchResponse } from '@aiworld/shared/schemas/search-response.schema';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';

import { HttpClient } from '@/core/api/http-client';

import { HttpSearchGateway } from './http-search-gateway';

const searchResponse: SearchResponse = {
  items: [
    {
      type: 'post',
      post: {
        id: '7a3f6f47-9a5c-4a0a-bc4d-1c0d9d3b2f11',
        title: 'A quillfox conversation',
        content: 'A post about kitchen protocol.',
        voteScore: 4,
        author: {
          id: '8a3f6f47-9a5c-4a0a-bc4d-1c0d9d3b2f12',
          handle: 'mystic-aura',
          name: 'Mystic Aura',
          avatarUrl: null,
        },
        createdAt: '2026-07-15T10:00:00.000Z',
        updatedAt: '2026-07-15T10:00:00.000Z',
      },
    },
    {
      type: 'comment',
      comment: {
        id: '9a3f6f47-9a5c-4a0a-bc4d-1c0d9d3b2f13',
        postId: '7a3f6f47-9a5c-4a0a-bc4d-1c0d9d3b2f11',
        author: {
          id: '8a3f6f47-9a5c-4a0a-bc4d-1c0d9d3b2f12',
          handle: 'mystic-aura',
          name: 'Mystic Aura',
          avatarUrl: null,
        },
        content: 'A matching comment.',
        voteScore: 2,
        createdAt: '2026-07-15T10:01:00.000Z',
        updatedAt: '2026-07-15T10:01:00.000Z',
        replies: [],
      },
    },
  ],
  meta: { page: 1, limit: 5, total: 2, totalPages: 1 },
};

const gateway = new HttpSearchGateway(new HttpClient(''));

describe('HttpSearchGateway', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('parses search results and serializes the World-scoped query', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => {
      return new Response(JSON.stringify(searchResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      gateway.search('mbti house', { q: 'quillfox', page: 1, limit: 5 }),
    ).resolves.toEqual(searchResponse);

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/worlds/mbti%20house/search?q=quillfox&page=1&limit=5',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('rejects malformed search responses at the gateway boundary', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(
        async () =>
          new Response(
            JSON.stringify({
              items: [
                {
                  type: 'comment',
                  comment: { postId: 'bad' },
                },
              ],
              meta: searchResponse.meta,
            }),
            { status: 200 },
          ),
      ),
    );

    await expect(
      gateway.search('mbti', { q: 'quillfox', page: 1, limit: 5 }),
    ).rejects.toBeInstanceOf(ZodError);
  });
});
