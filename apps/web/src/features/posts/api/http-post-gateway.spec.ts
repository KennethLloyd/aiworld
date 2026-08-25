import type { PostDetailResponse } from '@aiworld/shared/schemas/post-response.schema';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';

import { HttpClient } from '@/core/api/http-client';

import { HttpPostGateway } from './http-post-gateway';

const postDetail: PostDetailResponse = {
  id: '7a3f6f47-9a5c-4a0a-bc4d-1c0d9d3b2f11',
  title: 'A detail conversation',
  content: 'A post with a threaded response.',
  voteScore: 7,
  author: {
    id: '8a3f6f47-9a5c-4a0a-bc4d-1c0d9d3b2f12',
    handle: 'mystic-aura',
    name: 'Mystic Aura',
    avatarUrl: null,
    classification: 'INFJ',
    classificationGroup: 'NF',
  },
  comments: [
    {
      id: '9a3f6f47-9a5c-4a0a-bc4d-1c0d9d3b2f13',
      author: {
        id: 'aa3f6f47-9a5c-4a0a-bc4d-1c0d9d3b2f14',
        handle: 'calm-voice',
        name: 'Calm Voice',
        avatarUrl: null,
      },
      content: 'The first response.',
      voteScore: 2,
      createdAt: '2026-07-15T10:01:00.000Z',
      updatedAt: '2026-07-15T10:01:00.000Z',
      replies: [],
    },
  ],
  createdAt: '2026-07-15T10:00:00.000Z',
  updatedAt: '2026-07-15T10:00:00.000Z',
};

const http = new HttpClient('');
const gateway = new HttpPostGateway(http);

describe('HttpPostGateway', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('parses a post detail response and serializes the nested endpoint', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => {
      return new Response(JSON.stringify(postDetail), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(gateway.getById('mbti house', postDetail.id)).resolves.toEqual(
      postDetail,
    );

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/worlds/mbti%20house/posts/7a3f6f47-9a5c-4a0a-bc4d-1c0d9d3b2f11',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('serializes cursor feed queries and forwards the abort signal', async () => {
    const response = {
      items: [
        {
          id: postDetail.id,
          title: postDetail.title,
          content: postDetail.content,
          voteScore: postDetail.voteScore,
          commentCount: postDetail.comments.length,
          author: {
            id: postDetail.author.id,
            handle: postDetail.author.handle,
            name: postDetail.author.name,
            avatarUrl: postDetail.author.avatarUrl,
          },
          createdAt: postDetail.createdAt,
          updatedAt: postDetail.updatedAt,
        },
      ],
      nextCursor: 'opaque-cursor',
    };
    const fetchMock = vi.fn<typeof fetch>(async () => {
      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);
    const controller = new AbortController();

    await expect(
      gateway.list(
        'mbti house',
        { sort: 'hot', limit: 5, cursor: 'opaque-cursor' },
        controller.signal,
      ),
    ).resolves.toEqual(response);

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/worlds/mbti%20house/posts?sort=hot&limit=5&cursor=opaque-cursor',
      expect.objectContaining({ signal: controller.signal }),
    );
  });

  it('rejects malformed post detail payloads at the gateway boundary', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(
        async () =>
          new Response(JSON.stringify({ id: 'not-a-uuid' }), { status: 200 }),
      ),
    );

    await expect(gateway.getById('mbti', postDetail.id)).rejects.toBeInstanceOf(
      ZodError,
    );
  });
});
