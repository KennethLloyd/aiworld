import type { WorldResponse } from '@aiworld/shared/schemas/world-response.schema';
import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { ApiError } from '@/core/api/api-error';
import { GatewaysProvider } from '@/providers/gateways-provider';
import { createQueryClient } from '@/providers/query-client';

import { useWorld } from './use-world';

const mbtiWorld: WorldResponse = {
  id: '6a3f6f47-9a5c-4a0a-bc4d-1c0d9d3b2f10',
  name: 'MBTI',
  slug: 'mbti',
  description: { about: 'A world about personality typology.' },
  rules: ['No harassment', 'Stay in character'],
  topicScope: 'Personality types, cognition and communication styles.',
  isActive: true,
  createdAt: '2026-07-01T10:00:00.000Z',
  updatedAt: '2026-07-15T10:00:00.000Z',
};

let detailRequests = 0;

const server = setupServer(
  http.get('*/api/worlds/mbti', () => {
    detailRequests += 1;
    return HttpResponse.json(mbtiWorld);
  }),
  http.get('*/api/worlds/missing', () => {
    detailRequests += 1;
    return HttpResponse.json(
      { statusCode: 404, message: 'Not Found', error: 'NotFoundException' },
      { status: 404 },
    );
  }),
);

describe('useWorld', () => {
  beforeAll(() => server.listen());
  afterEach(() => {
    server.resetHandlers();
    detailRequests = 0;
  });
  afterAll(() => server.close());

  function wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={createQueryClient()}>
        <GatewaysProvider>{children}</GatewaysProvider>
      </QueryClientProvider>
    );
  }

  it('stays disabled while the slug is empty (no fetch fires)', async () => {
    const { result } = renderHook(() => useWorld(''), { wrapper });

    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(result.current.isPending).toBe(true);
    expect(detailRequests).toBe(0);
  });

  it('fetches and parses the world for a known slug', async () => {
    const { result } = renderHook(() => useWorld('mbti'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.name).toBe('MBTI');
    expect(result.current.data?.rules).toHaveLength(2);
    expect(detailRequests).toBe(1);
  });

  it('does not enable public polling by default', async () => {
    const client = createQueryClient();
    function clientWrapper({ children }: { children: React.ReactNode }) {
      return (
        <QueryClientProvider client={client}>
          <GatewaysProvider>{children}</GatewaysProvider>
        </QueryClientProvider>
      );
    }

    const { result } = renderHook(() => useWorld('mbti'), {
      wrapper: clientWrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const query = client.getQueryCache().find({
      queryKey: ['worlds', 'detail', 'mbti'],
    });

    const queryOptions = query?.options as { refetchInterval?: number };
    expect(queryOptions.refetchInterval).toBeUndefined();
  });

  it('exposes ApiError(404) so the route can render the not-found state', async () => {
    const { result } = renderHook(() => useWorld('missing'), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(ApiError);
    expect((result.current.error as ApiError).status).toBe(404);
  });

  it('refetches when the slug changes to a new query key', async () => {
    const { result, rerender } = renderHook(
      ({ slug }: { slug: string }) => useWorld(slug),
      { wrapper, initialProps: { slug: 'mbti' } },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    rerender({ slug: 'missing' });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as ApiError).status).toBe(404);
    expect(detailRequests).toBe(2);
  });

  it('configures the public world snapshot polling cadence', async () => {
    const client = createQueryClient();
    function clientWrapper({ children }: { children: React.ReactNode }) {
      return (
        <QueryClientProvider client={client}>
          <GatewaysProvider>{children}</GatewaysProvider>
        </QueryClientProvider>
      );
    }

    const { result } = renderHook(() => useWorld('mbti', { polling: true }), {
      wrapper: clientWrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const query = client.getQueryCache().find({
      queryKey: ['worlds', 'detail', 'mbti'],
    });

    const pollingOptions = query?.options as { refetchInterval?: number };
    expect(pollingOptions.refetchInterval).toBe(30_000);
  });
});
