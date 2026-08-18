import type { WorldResponse } from '@aiworld/shared/schemas/world-response.schema';
import { QueryClient } from '@tanstack/react-query';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { sessionKeys } from '@/core/auth/session-keys';
import { createQueryClient } from '@/providers/query-client';
import { renderAuthRoutes } from '@/test/auth-router-harness';
import { makeSession } from '@/test/fixtures/auth-session';

function makeWorld(index: number): WorldResponse {
  return {
    id: `6a3f6f47-9a5c-4a0a-bc4d-1c0d9d3b2f${String(index).padStart(2, '0')}`,
    name: `World ${index}`,
    slug: `world-${index}`,
    description: null,
    rules: ['Stay in character'],
    topicScope: `Topic scope for world ${index}.`,
    residentCount: 16,
    isActive: index % 2 === 0,
    createdAt: '2026-07-01T10:00:00.000Z',
    updatedAt: '2026-07-15T10:00:00.000Z',
  };
}

const twoWorlds: WorldResponse[] = [makeWorld(1), makeWorld(2)];

let worlds: WorldResponse[];
let lastSearch: string | null;
let lastPage: number;
let patchRequests: { slug: string; body: Record<string, unknown> }[];
let deleteRequests: string[];

const server = setupServer(
  http.get('*/api/worlds', async ({ request }) => {
    const url = new URL(request.url);
    lastPage = Number(url.searchParams.get('page') ?? '1');
    lastSearch = url.searchParams.get('search');
    const items = worlds.slice((lastPage - 1) * 20, lastPage * 20);
    return HttpResponse.json({
      items,
      meta: {
        page: lastPage,
        limit: 20,
        total: worlds.length,
        totalPages: Math.ceil(worlds.length / 20),
      },
    });
  }),
  http.patch('*/api/worlds/:slug', async ({ params, request }) => {
    const slug = String(params.slug);
    const body = (await request.json()) as Record<string, unknown>;
    patchRequests.push({ slug, body });
    const world = worlds.find((item) => item.slug === slug);
    return HttpResponse.json(world ? { ...world, ...body } : makeWorld(99));
  }),
  http.delete('*/api/worlds/:slug', ({ params }) => {
    const slug = String(params.slug);
    deleteRequests.push(slug);
    worlds = worlds.filter((item) => item.slug !== slug);
    return new HttpResponse(null, { status: 204 });
  }),
);

/** Focused error-state tests disable retries so 5xx surfaces immediately. */
function retryDisabledClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

describe('/admin/worlds route', () => {
  beforeAll(() => server.listen());
  afterEach(() => {
    server.resetHandlers();
    worlds = [...twoWorlds];
    lastSearch = null;
    lastPage = 1;
    patchRequests = [];
    deleteRequests = [];
  });
  afterAll(() => server.close());

  it('redirects anonymous visitors to sign-in with the current href', async () => {
    const client = createQueryClient();
    client.setQueryData(sessionKeys.current, null);

    const { router } = renderAuthRoutes('/admin/worlds', {
      queryClient: client,
    });

    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/auth/sign-in'),
    );
    const search = new URLSearchParams(router.state.location.searchStr);
    // validateSearch normalizes the list URL to its defaults before the
    // guard reads location.href, so the redirect target carries them.
    expect(search.get('redirect')).toBe('/admin/worlds?page=1&limit=20');
  });

  it('redirects authenticated non-ADMIN users to /403', async () => {
    const client = createQueryClient();
    client.setQueryData(sessionKeys.current, makeSession('USER'));

    const { router } = renderAuthRoutes('/admin/worlds', {
      queryClient: client,
    });

    await waitFor(() => expect(router.state.location.pathname).toBe('/403'));
  });

  it('renders the worlds table with status, actions, and a New World link', async () => {
    const client = createQueryClient();
    client.setQueryData(sessionKeys.current, makeSession('ADMIN'));

    renderAuthRoutes('/admin/worlds', { queryClient: client });

    expect(
      await screen.findByRole('heading', { name: 'Worlds' }),
    ).toBeInTheDocument();
    // DataTable renders the table on sm+ screens and stacked cards below, so
    // each row's content appears twice.
    expect((await screen.findAllByText('World 1')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('World 2').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Active').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Inactive').length).toBeGreaterThan(0);

    const editLink = screen.getAllByRole('link', { name: 'Edit World 1' })[0];
    expect(editLink).toHaveAttribute(
      'href',
      expect.stringContaining('/admin/worlds/world-1'),
    );
    const newWorldLink = screen.getByRole('link', { name: 'New World' });
    expect(newWorldLink).toHaveAttribute(
      'href',
      expect.stringContaining('/admin/worlds/new'),
    );
    expect(screen.getByLabelText('Search worlds')).toBeInTheDocument();
  });

  it('debounces search input into a new list query', async () => {
    const client = createQueryClient();
    client.setQueryData(sessionKeys.current, makeSession('ADMIN'));

    renderAuthRoutes('/admin/worlds', { queryClient: client });

    await screen.findAllByText('World 1');

    await userEvent.type(screen.getByLabelText('Search worlds'), 'mbti');

    await waitFor(() => expect(lastSearch).toBe('mbti'));
  });

  it('paginates to the next page', async () => {
    worlds = Array.from({ length: 25 }, (_, index) => makeWorld(index + 1));
    const client = createQueryClient();
    client.setQueryData(sessionKeys.current, makeSession('ADMIN'));

    renderAuthRoutes('/admin/worlds', { queryClient: client });

    expect((await screen.findAllByText('World 20')).length).toBeGreaterThan(0);

    await userEvent.click(screen.getByRole('button', { name: 'Next' }));

    await waitFor(() => expect(lastPage).toBe(2));
    expect(await screen.findByText('Page 2 of 2')).toBeInTheDocument();
  });

  it('toggles a world active status through the update mutation', async () => {
    const client = createQueryClient();
    client.setQueryData(sessionKeys.current, makeSession('ADMIN'));

    renderAuthRoutes('/admin/worlds', { queryClient: client });

    await screen.findAllByText('World 1');

    // world-2 is the active fixture (index % 2 === 0), so its status button
    // reads "Deactivate".
    await userEvent.click(
      screen.getAllByRole('button', { name: 'Deactivate' })[0],
    );

    expect(await screen.findByText('World deactivated')).toBeInTheDocument();
    expect(patchRequests[0]).toEqual({
      slug: 'world-2',
      body: { isActive: false },
    });
  });

  it('deletes a world after confirmation', async () => {
    const client = createQueryClient();
    client.setQueryData(sessionKeys.current, makeSession('ADMIN'));

    renderAuthRoutes('/admin/worlds', { queryClient: client });

    await screen.findAllByText('World 1');

    await userEvent.click(
      screen.getAllByRole('button', { name: 'Delete World 1' })[0],
    );

    const dialog = await screen.findByRole('dialog', { name: 'Delete world' });
    expect(within(dialog).getByText(/cannot be undone/)).toBeInTheDocument();

    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Delete' }),
    );

    expect(await screen.findByText('World deleted')).toBeInTheDocument();
    expect(deleteRequests).toEqual(['world-1']);
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(screen.queryAllByText('World 1')).toHaveLength(0);
  });

  it('renders the empty state for an empty directory', async () => {
    server.use(
      http.get('*/api/worlds', () =>
        HttpResponse.json({
          items: [],
          meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
        }),
      ),
    );
    const client = createQueryClient();
    client.setQueryData(sessionKeys.current, makeSession('ADMIN'));

    renderAuthRoutes('/admin/worlds', { queryClient: client });

    expect(
      await screen.findByRole('heading', { name: 'No worlds yet' }),
    ).toBeInTheDocument();
  });

  it('renders the forbidden error state for a 403 list response', async () => {
    server.use(
      http.get('*/api/worlds', () =>
        HttpResponse.json(
          {
            statusCode: 403,
            message: 'Forbidden',
            error: 'ForbiddenException',
          },
          { status: 403 },
        ),
      ),
    );
    const client = createQueryClient();
    client.setQueryData(sessionKeys.current, makeSession('ADMIN'));

    renderAuthRoutes('/admin/worlds', { queryClient: client });

    expect(
      await screen.findByRole('heading', { name: 'Access denied' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Your account cannot list admin worlds.'),
    ).toBeInTheDocument();
  });

  it('renders ErrorState with retry for other list failures', async () => {
    server.use(
      http.get('*/api/worlds', () =>
        HttpResponse.json(
          { statusCode: 500, message: 'Internal Server Error', error: 'Error' },
          { status: 500 },
        ),
      ),
    );
    const client = retryDisabledClient();
    client.setQueryData(sessionKeys.current, makeSession('ADMIN'));

    renderAuthRoutes('/admin/worlds', { queryClient: client });

    expect(
      await screen.findByRole('heading', { name: 'Could not load worlds' }),
    ).toBeInTheDocument();

    server.use(
      http.get('*/api/worlds', () =>
        HttpResponse.json({
          items: twoWorlds,
          meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
        }),
      ),
    );

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect((await screen.findAllByText('World 1')).length).toBeGreaterThan(0);
  });
});
