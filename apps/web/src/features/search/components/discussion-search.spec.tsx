import type { SearchResponse } from '@aiworld/shared/schemas/search-response.schema';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  RouterProvider,
  createMemoryHistory,
  createRoute,
  createRootRoute,
  createRouter,
} from '@tanstack/react-router';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { searchWorld } from '../api/search-api';
import { DiscussionSearch } from './discussion-search';

vi.mock('../api/search-api', () => ({
  searchWorld: vi.fn<typeof searchWorld>(),
}));

const postId = '7a3f6f47-9a5c-4a0a-bc4d-1c0d9d3b2f11';
const response: SearchResponse = {
  items: [
    {
      type: 'post',
      post: {
        id: postId,
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
        postId,
        author: {
          id: '8a3f6f47-9a5c-4a0a-bc4d-1c0d9d3b2f12',
          handle: 'mystic-aura',
          name: 'Mystic Aura',
          avatarUrl: null,
        },
        content: 'The matching comment.',
        voteScore: 2,
        createdAt: '2026-07-15T10:01:00.000Z',
        updatedAt: '2026-07-15T10:01:00.000Z',
        replies: [],
      },
    },
  ],
  meta: { page: 1, limit: 20, total: 2, totalPages: 1 },
};

describe('DiscussionSearch', () => {
  it('validates short input without calling the search API', async () => {
    const search = vi.fn<typeof searchWorld>().mockResolvedValue(response);

    await renderSearch(search);

    await userEvent.type(
      screen.getByRole('combobox', { name: 'Search discussions' }),
      'a',
    );

    expect(
      screen.getByText('Enter at least 2 characters to search.'),
    ).toBeInTheDocument();
    expect(search).not.toHaveBeenCalled();
  });

  it('shows post and comment matches that both open the parent post', async () => {
    const search = vi.fn<typeof searchWorld>().mockResolvedValue(response);

    await renderSearch(search);

    await userEvent.type(
      screen.getByRole('combobox', { name: 'Search discussions' }),
      'quillfox',
    );

    expect(
      await screen.findByRole('option', { name: /A quillfox conversation/ }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Discussion search results')).toHaveClass(
      'bg-surface/95',
    );
    expect(
      screen.getByRole('group', { name: /Vote score 4.*read-only/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('group', { name: /Vote score 2.*read-only/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: /A quillfox conversation/ }),
    ).toHaveAttribute('href', `/worlds/mbti/posts/${postId}`);
    expect(
      screen.getByRole('option', { name: /The matching comment/ }),
    ).toHaveAttribute('href', `/worlds/mbti/posts/${postId}`);
    expect(search).toHaveBeenCalledWith('mbti', {
      q: 'quillfox',
      page: 1,
      limit: 20,
    });
  });

  it('shows the empty state for a valid query with no matches', async () => {
    const search = vi.fn<typeof searchWorld>().mockResolvedValue({
      ...response,
      items: [],
      meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });

    await renderSearch(search);

    await userEvent.type(
      screen.getByRole('combobox', { name: 'Search discussions' }),
      'zebra',
    );

    expect(
      await screen.findByText('No discussions found.'),
    ).toBeInTheDocument();
  });
});

async function renderSearch(search: typeof searchWorld) {
  const rootRoute = createRootRoute();
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: () => <DiscussionSearch worldSlug="mbti" />,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  });
  await router.load();
  vi.mocked(searchWorld).mockImplementation(search);

  return render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}
