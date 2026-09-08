import type {
  ListWorldsResponse,
  WorldResponse,
} from '@aiworld/shared/schemas/world-response.schema';
import type {
  CreateWorld,
  UpdateWorld,
} from '@aiworld/shared/schemas/world.schema';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';

import { ApiError } from '@/core/api/api-error';

import {
  createWorld,
  deleteWorld,
  getWorldBySlug,
  listWorlds,
  updateWorld,
} from './world-api';

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

const listResponse: ListWorldsResponse = {
  items: [world],
  meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
};

/** Asserts the error is an ApiError and narrows it for the following checks. */
function expectApiError(error: unknown): ApiError {
  expect(error).toBeInstanceOf(ApiError);
  return error as ApiError;
}

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

  it('parses a valid list response and serializes the query params', async () => {
    const fetchMock = mockFetch(200, listResponse);

    const result = await listWorlds({ search: 'mbti', page: 2, limit: 10 });

    expect(result).toEqual(listResponse);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/worlds?search=mbti&page=2&limit=10',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('omits the search param and defaults page/limit when absent', async () => {
    const fetchMock = mockFetch(200, listResponse);

    await listWorlds({ search: undefined, page: 1, limit: 20 });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/worlds?page=1&limit=20',
      expect.anything(),
    );
  });

  it('serializes the public active-only filter when requested by the client', async () => {
    const fetchMock = mockFetch(200, listResponse);

    await listWorlds({ page: 1, limit: 20, isActive: true });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/worlds?page=1&limit=20&isActive=true',
      expect.anything(),
    );
  });

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

  it('parses a valid detail response and hits the plural slug endpoint', async () => {
    const fetchMock = mockFetch(200, world);

    const result = await getWorldBySlug('mbti');

    expect(result).toEqual(world);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/worlds/mbti',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('propagates ApiError(404) from a missing world', async () => {
    mockFetch(404, {
      statusCode: 404,
      message: 'Not Found',
      error: 'NotFoundException',
    });

    const error = expectApiError(
      await getWorldBySlug('missing').catch((caught: unknown) => caught),
    );

    expect(error.status).toBe(404);
  });

  it('rejects a malformed detail payload', async () => {
    mockFetch(200, { name: 'Missing required fields' });

    await expect(getWorldBySlug('mbti')).rejects.toBeInstanceOf(ZodError);
  });

  it('creates through the collection endpoint and parses the response', async () => {
    const fetchMock = mockFetch(201, world);
    const input: CreateWorld = {
      name: 'MBTI',
      slug: 'mbti',
      description: { about: 'Typology.' },
      rules: [],
      topicScope: 'Personality typology.',
      isActive: true,
    };

    const result = await createWorld(input);

    expect(result).toEqual(world);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/worlds',
      expect.objectContaining({ method: 'POST' }),
    );
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

  it('updates through the slug endpoint and parses the response', async () => {
    const fetchMock = mockFetch(200, world);
    const input: UpdateWorld = { name: 'MBTI 2' };

    const result = await updateWorld('mbti', input);

    expect(result).toEqual(world);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/worlds/mbti',
      expect.objectContaining({ method: 'PATCH' }),
    );
  });

  it('deletes through the slug endpoint and resolves void', async () => {
    const fetchMock = mockFetch(204);

    await expect(deleteWorld('mbti')).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/worlds/mbti',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });
});
