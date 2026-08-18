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

import type { CharacterGateway } from '@/features/characters/api/character-gateway';
import type { PostGateway } from '@/features/posts/api/post-gateway';
import type { WorldGateway } from '@/features/worlds/api/world-gateway';
import {
  GatewaysProvider,
  type AppGateways,
} from '@/providers/gateways-provider';

import type { SearchGateway } from '../api/search-gateway';
import { DiscussionSearch } from './discussion-search';

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
  it('validates short input without calling the search gateway', async () => {
    const search = vi.fn<SearchGateway['search']>().mockResolvedValue(response);

    await renderSearch(search);

    await userEvent.type(
      screen.getByRole('textbox', { name: 'Search discussions' }),
      'a',
    );

    expect(
      screen.getByText('Enter at least 2 characters to search.'),
    ).toBeInTheDocument();
    expect(search).not.toHaveBeenCalled();
  });

  it('shows post and comment matches that both open the parent post', async () => {
    const search = vi.fn<SearchGateway['search']>().mockResolvedValue(response);

    await renderSearch(search);

    await userEvent.type(
      screen.getByRole('textbox', { name: 'Search discussions' }),
      'quillfox',
    );

    expect(
      await screen.findByText('A quillfox conversation'),
    ).toBeInTheDocument();
    expect(screen.getByText('The matching comment.')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /A quillfox conversation/ }),
    ).toHaveAttribute('href', `/worlds/mbti/posts/${postId}`);
    expect(
      screen.getByRole('link', { name: /The matching comment/ }),
    ).toHaveAttribute('href', `/worlds/mbti/posts/${postId}`);
    expect(search).toHaveBeenCalledWith('mbti', {
      q: 'quillfox',
      page: 1,
      limit: 20,
    });
  });

  it('shows the empty state for a valid query with no matches', async () => {
    const search = vi.fn<SearchGateway['search']>().mockResolvedValue({
      ...response,
      items: [],
      meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });

    await renderSearch(search);

    await userEvent.type(
      screen.getByRole('textbox', { name: 'Search discussions' }),
      'zebra',
    );

    expect(
      await screen.findByText('No discussions found.'),
    ).toBeInTheDocument();
  });
});

async function renderSearch(search: SearchGateway['search']) {
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
  const gateways: AppGateways = {
    worldGateway: unusedWorldGateway,
    postGateway: unusedPostGateway,
    characterGateway: unusedCharacterGateway,
    searchGateway: { search },
  };

  return render(
    <QueryClientProvider client={new QueryClient()}>
      <GatewaysProvider value={gateways}>
        <RouterProvider router={router} />
      </GatewaysProvider>
    </QueryClientProvider>,
  );
}

const unusedWorldGateway: WorldGateway = {
  list: async () => {
    throw new Error('unused test adapter');
  },
  getBySlug: async () => {
    throw new Error('unused test adapter');
  },
  create: async () => {
    throw new Error('unused test adapter');
  },
  update: async () => {
    throw new Error('unused test adapter');
  },
  delete: async () => {
    throw new Error('unused test adapter');
  },
};

const unusedPostGateway: PostGateway = {
  list: async () => {
    throw new Error('unused test adapter');
  },
  getById: async () => {
    throw new Error('unused test adapter');
  },
};

const unusedCharacterGateway: CharacterGateway = {
  list: async () => {
    throw new Error('unused test adapter');
  },
  getById: async () => {
    throw new Error('unused test adapter');
  },
  getActivity: async () => {
    throw new Error('unused test adapter');
  },
};
