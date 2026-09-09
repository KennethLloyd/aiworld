import type { WorldResponse } from '@aiworld/shared/schemas/world-response.schema';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';

import { createWorld, getWorldBySlug, listWorlds } from './world-api';

const world: WorldResponse = {
  id: '6a3f6f47-9a5c-4a0a-bc4d-1c0d9d3b2f10',
  name: 'MBTI',
  slug: 'mbti',
  description: {
    about: 'A world about personality typology.',
    en: 'English description.',
  },
  rules: ['No harassment', 'Stay in character'],
  topicScope: 'Personality types, cognition and communication styles.',
  residentCount: 16,
  isActive: true,
  createdAt: '2026-07-01T10:00:00.000Z',
  updatedAt: '2026-07-15T10:00:00.000Z',
};

describe('world API functions', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function mockFetch(status: number, body?: unknown) {
    const fetchMock = vi.fn<typeof fetch>(async () => {
      if (body === undefined) {
        return new Response(null, { status });
      }
      return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  it('rejects a malformed list payload before anything can be cached', async () => {
    mockFetch(200, { items: 'not-an-array', meta: { page: 1 } });

    await expect(listWorlds({ page: 1, limit: 20 })).rejects.toBeInstanceOf(
      ZodError,
    );
  });

  it('rejects a list payload missing the pagination meta contract', async () => {
    mockFetch(200, { items: [world], meta: { page: 1, limit: 20 } });

    await expect(listWorlds({ page: 1, limit: 20 })).rejects.toBeInstanceOf(
      ZodError,
    );
  });

  it('rejects a malformed detail payload', async () => {
    mockFetch(200, { name: 'Missing required fields' });

    await expect(getWorldBySlug('mbti')).rejects.toBeInstanceOf(ZodError);
  });

  it('rejects a malformed create response', async () => {
    mockFetch(201, { id: 'not-a-uuid' });

    await expect(
      createWorld({
        name: 'MBTI',
        slug: 'mbti',
        description: null,
        rules: [],
        topicScope: 'Typology.',
      }),
    ).rejects.toBeInstanceOf(ZodError);
  });
});
