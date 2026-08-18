import type {
  ListWorldsResponse,
  WorldResponse,
} from '@aiworld/shared/schemas/world-response.schema';
import { QueryClient } from '@tanstack/react-query';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { renderPublicRoutes } from '@/test/router-harness';

/** Focused error-state tests disable retries so 5xx surfaces immediately. */
function retryDisabledClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

const world = (page: number, index: number): WorldResponse => ({
  id: `6a3f6f47-9a5c-4a0a-bc4d-1c0d9d3b2f${page}${index}`,
  name: `World ${page}-${index}`,
  slug: `world-${page}-${index}`,
  description: null,
  rules: ['Stay in character'],
  topicScope: `Topic scope excerpt for world ${page}-${index}.`,
  isActive: true,
  createdAt: '2026-07-01T10:00:00.000Z',
  updatedAt: '2026-07-15T10:00:00.000Z',
});

const listFor = (page: number, total = 3): ListWorldsResponse => ({
  items: [world(page, 1), world(page, 2)],
  meta: { page, limit: 20, total, totalPages: Math.ceil(total / 2) },
});

const emptyList: ListWorldsResponse = {
  items: [],
  meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
};

let lastSearch: string | null = null;
let listResponses: Array<{ page: number; search: string | null }> = [];

const server = setupServer(
  http.get('*/api/worlds', async ({ request }) => {
    const url = new URL(request.url);
    const page = Number(url.searchParams.get('page') ?? '1');
    const search = url.searchParams.get('search');
    lastSearch = search;
    listResponses.push({ page, search });
    if (page === 2) {
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
    return HttpResponse.json(listFor(page));
  }),
);

describe('public worlds list route', () => {
  beforeAll(() => server.listen());
  afterEach(() => {
    server.resetHandlers();
    lastSearch = null;
    listResponses = [];
  });
  afterAll(() => server.close());

  it('redirects / to the canonical /worlds list', async () => {
    renderPublicRoutes('/');

    expect(
      await screen.findByRole('heading', { name: 'Worlds' }),
    ).toBeInTheDocument();
    expect(await screen.findByText('World 1-1')).toBeInTheDocument();
  });

  it('renders the loading skeleton before the first payload arrives', async () => {
    // Keep the first response in flight so the skeleton state is observable.
    server.use(
      http.get('*/api/worlds', async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return HttpResponse.json(listFor(1));
      }),
    );

    renderPublicRoutes('/worlds');

    expect(
      await screen.findByTestId('world-list-skeleton'),
    ).toBeInTheDocument();
    expect(await screen.findByText('World 1-1')).toBeInTheDocument();
  });

  it('renders cards with name, topic excerpt, status, and links to detail', async () => {
    renderPublicRoutes('/worlds');

    expect(
      await screen.findByRole('heading', { name: 'Active Simulations' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Observe autonomous worlds living/),
    ).toBeInTheDocument();

    const card = await screen.findByRole('link', { name: 'View World 1-1' });
    expect(card).toHaveAttribute('href', '/worlds/world-1-1?sort=hot');
    expect(
      screen.getByText('Topic scope excerpt for world 1-1.'),
    ).toBeInTheDocument();
    // Public cards use the prototype's Live label without duplicating status.
    expect(screen.queryByText('Active')).not.toBeInTheDocument();
    expect(screen.getAllByText('Live')).toHaveLength(2);
    expect(screen.queryByText('Public observers')).not.toBeInTheDocument();
    expect(screen.getAllByText('Active Chatter')).toHaveLength(2);
    expect(screen.queryByText('Page 1 of 2')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Next page' }),
    ).toBeInTheDocument();
  });

  it('debounces search input into the URL and issues a new list query', async () => {
    renderPublicRoutes('/worlds');

    await screen.findByText('World 1-1');

    const input = screen.getByLabelText('Search worlds');
    await userEvent.type(input, 'mbti');

    await waitFor(() => {
      expect(lastSearch).toBe('mbti');
    });
    expect(listResponses.some((call) => call.search === 'mbti')).toBe(true);
  });

  it('keeps the previous page visible while the next page loads', async () => {
    renderPublicRoutes('/worlds');

    await screen.findByText('World 1-1');

    await userEvent.click(screen.getByRole('button', { name: 'Next page' }));

    // Placeholder data: page 1 stays on screen while page 2 is in flight.
    expect(screen.getByText('World 1-1')).toBeInTheDocument();
    expect(await screen.findByText('World 2-1')).toBeInTheDocument();
  });

  it('renders the empty state for an empty directory', async () => {
    server.use(http.get('*/api/worlds', () => HttpResponse.json(emptyList)));

    renderPublicRoutes('/worlds');

    expect(
      await screen.findByRole('heading', { name: 'No worlds yet' }),
    ).toBeInTheDocument();
  });

  it('renders ErrorState with retry and recovers', async () => {
    server.use(
      http.get('*/api/worlds', () =>
        HttpResponse.json(
          { statusCode: 500, message: 'Internal Server Error', error: 'Error' },
          { status: 500 },
        ),
      ),
    );

    renderPublicRoutes('/worlds', { queryClient: retryDisabledClient() });

    expect(
      await screen.findByRole('heading', { name: 'Could not load worlds' }),
    ).toBeInTheDocument();

    server.use(http.get('*/api/worlds', () => HttpResponse.json(listFor(1))));

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('World 1-1')).toBeInTheDocument();
  });
});
