import type { WorldResponse } from '@aiworld/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { ApiError } from '@/core/api/api-error';
import { GatewaysProvider } from '@/providers/gateways-provider';
import { createQueryClient } from '@/providers/query-client';

import { useWorlds } from './use-worlds';

const worldOnPage = (page: number): WorldResponse => ({
  id: `6a3f6f47-9a5c-4a0a-bc4d-1c0d9d3b2f1${page}`,
  name: `World page ${page}`,
  slug: `world-page-${page}`,
  description: null,
  rules: ['Stay in character'],
  topicScope: 'A sample world for hook tests.',
  isActive: true,
  createdAt: '2026-07-01T10:00:00.000Z',
  updatedAt: '2026-07-15T10:00:00.000Z',
});

let listRequests = 0;

const server = setupServer(
  http.get('*/api/worlds', async ({ request }) => {
    listRequests += 1;
    const url = new URL(request.url);
    const page = Number(url.searchParams.get('page') ?? '1');
    // Keep page 2 in flight long enough to assert placeholderData behavior.
    if (page === 2) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return HttpResponse.json({
      items: [worldOnPage(page)],
      meta: { page, limit: 20, total: 2, totalPages: 2 },
    });
  }),
);

/** Focused error-state wrapper: disable retries so errors surface at once. */
function createQueryClientWithRetryDisabled(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

describe('useWorlds', () => {
  beforeAll(() => server.listen());
  afterEach(() => {
    server.resetHandlers();
    listRequests = 0;
  });
  afterAll(() => server.close());

  function wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={createQueryClient()}>
        <GatewaysProvider>{children}</GatewaysProvider>
      </QueryClientProvider>
    );
  }

  it('fetches through the gateway, parses with Zod, and exposes the data', async () => {
    const { result } = renderHook(
      () => useWorlds({ search: undefined, page: 1, limit: 20 }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.items[0]?.name).toBe('World page 1');
    expect(result.current.data?.meta.page).toBe(1);
    expect(listRequests).toBe(1);
  });

  it('keeps previous data visible while a page change is in flight', async () => {
    const { result, rerender } = renderHook(
      ({ page }: { page: number }) =>
        useWorlds({ search: undefined, page, limit: 20 }),
      { wrapper, initialProps: { page: 1 } },
    );

    await waitFor(() => expect(result.current.data?.meta.page).toBe(1));

    rerender({ page: 2 });

    // placeholderData keeps the page-1 grid while page 2 loads: the observer
    // reports success with the previous data flagged as placeholder.
    await waitFor(() => expect(result.current.isPlaceholderData).toBe(true));
    expect(result.current.data?.meta.page).toBe(1);
    expect(result.current.isSuccess).toBe(true);

    await waitFor(() => expect(result.current.data?.meta.page).toBe(2));
    expect(result.current.isPlaceholderData).toBe(false);
  });

  it('maps a server error to the query error state', async () => {
    server.use(
      http.get('*/api/worlds', () =>
        HttpResponse.json(
          { statusCode: 500, message: 'Internal Server Error', error: 'Error' },
          { status: 500 },
        ),
      ),
    );

    const { result } = renderHook(
      () => useWorlds({ search: undefined, page: 1, limit: 20 }),
      {
        wrapper: ({ children }: { children: React.ReactNode }) => (
          <QueryClientProvider client={createQueryClientWithRetryDisabled()}>
            <GatewaysProvider>{children}</GatewaysProvider>
          </QueryClientProvider>
        ),
      },
    );

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toBeInstanceOf(ApiError);
    expect((result.current.error as ApiError).status).toBe(500);
  });
});
