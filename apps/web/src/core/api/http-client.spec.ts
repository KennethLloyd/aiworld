import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from './api-error';
import { HttpClient } from './http-client';

const client = new HttpClient('');

/** Asserts the error is an ApiError and narrows it for the following checks. */
function expectApiError(error: unknown): ApiError {
  expect(error).toBeInstanceOf(ApiError);
  return error as ApiError;
}

describe('HttpClient', () => {
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

  it('sends credentials include on every request and returns raw JSON', async () => {
    const fetchMock = mockFetch(200, { items: [] });

    const result = await client.get<{ items: unknown[] }>('/api/worlds');

    expect(result).toEqual({ items: [] });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/worlds',
      expect.objectContaining({
        method: 'GET',
        credentials: 'include',
      }),
    );
  });

  it('passes the AbortSignal through to fetch', async () => {
    const fetchMock = mockFetch(200, {});
    const controller = new AbortController();

    await client.get('/api/worlds', controller.signal);

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/worlds',
      expect.objectContaining({ signal: controller.signal }),
    );
  });

  it('resolves void on 204 without parsing the empty body', async () => {
    const fetchMock = mockFetch(204);

    await expect(client.delete('/api/worlds/mbti')).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/worlds/mbti',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('sends a JSON body on post and patch', async () => {
    mockFetch(200, { id: '1' });

    await client.post('/api/worlds', { name: 'mbti' });
    await client.patch('/api/worlds/mbti', { name: 'MBTI' });

    expect(vi.mocked(fetch).mock.calls[0]?.[1]).toMatchObject({
      method: 'POST',
      body: JSON.stringify({ name: 'mbti' }),
    });
    expect(vi.mocked(fetch).mock.calls[1]?.[1]).toMatchObject({
      method: 'PATCH',
      body: JSON.stringify({ name: 'MBTI' }),
    });
  });

  it('maps a 400 envelope with ZodIssue[] message to an ApiError', async () => {
    mockFetch(400, {
      statusCode: 400,
      message: [
        { code: 'invalid_string', message: 'Name is required', path: ['name'] },
        { code: 'invalid_string', message: 'Slug is invalid', path: ['slug'] },
      ],
      error: 'Validation Failed',
    });

    const error = expectApiError(
      await client.get('/api/worlds').catch((caught: unknown) => caught),
    );

    expect(error.status).toBe(400);
    expect(error.error).toBe('Validation Failed');
    expect(error.issues).toHaveLength(2);
    expect(error.toUserMessage()).toBe('Name is required, Slug is invalid');
  });

  it('maps a 404 envelope with a string message to an ApiError', async () => {
    mockFetch(404, {
      statusCode: 404,
      message: 'Not Found',
      error: 'NotFoundException',
    });

    const error = expectApiError(
      await client
        .get('/api/worlds/missing')
        .catch((caught: unknown) => caught),
    );

    expect(error.status).toBe(404);
    expect(error.message).toBe('Not Found');
    expect(error.issues).toEqual([]);
    expect(error.toUserMessage()).toBe('Not Found');
  });

  it('falls back to a generic HttpError when the body is not the envelope', async () => {
    mockFetch(500, { unexpected: true });

    const error = expectApiError(
      await client.get('/api/worlds').catch((caught: unknown) => caught),
    );

    expect(error.status).toBe(500);
    expect(error.message).toBe('Request failed');
    expect(error.error).toBe('HttpError');
  });

  it('falls back when the error body is not JSON at all', async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => {
      return new Response('plain text error', { status: 502 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const error = expectApiError(
      await client.get('/api/worlds').catch((caught: unknown) => caught),
    );

    expect(error.status).toBe(502);
    expect(error.message).toBe('Request failed');
    expect(error.error).toBe('HttpError');
  });
});
