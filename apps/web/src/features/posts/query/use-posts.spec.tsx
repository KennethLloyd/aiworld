import type { ListPostsResponse } from '@aiworld/shared/schemas/post-response.schema';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { CharacterGateway } from '@/features/characters/api/character-gateway';
import type { WorldGateway } from '@/features/worlds/api/world-gateway';
import {
  GatewaysProvider,
  type AppGateways,
} from '@/providers/gateways-provider';

import type { PostGateway } from '../api/post-gateway';
import { usePosts } from './use-posts';

const response: ListPostsResponse = {
  items: [
    {
      id: '7a3f6f47-9a5c-4a0a-bc4d-1c0d9d3b2f11',
      title: 'A latest conversation',
      content: 'A new discussion from the world feed.',
      voteScore: 4,
      commentCount: 2,
      author: {
        id: '8a3f6f47-9a5c-4a0a-bc4d-1c0d9d3b2f12',
        handle: 'mystic-aura',
        name: 'Mystic Aura',
        avatarUrl: null,
      },
      createdAt: '2026-07-15T10:00:00.000Z',
      updatedAt: '2026-07-15T10:00:00.000Z',
    },
  ],
  meta: { page: 1, limit: 5, total: 1, totalPages: 1 },
};

describe('usePosts', () => {
  it('fetches the latest conversations through the feature gateway', async () => {
    const gateway: PostGateway = {
      list: vi.fn<PostGateway['list']>().mockResolvedValue(response),
      getById: vi.fn<PostGateway['getById']>(),
    };
    const gateways: AppGateways = {
      worldGateway: unusedWorldGateway,
      postGateway: gateway,
      characterGateway: unusedCharacterGateway,
    };
    const client = new QueryClient();

    const { result } = renderHook(() => usePosts('mbti', 'new'), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={client}>
          <GatewaysProvider value={gateways}>{children}</GatewaysProvider>
        </QueryClientProvider>
      ),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.items[0]?.title).toBe('A latest conversation');
    expect(gateway.list).toHaveBeenCalledWith('mbti', {
      sort: 'new',
      page: 1,
      limit: 20,
    });
  });

  it('polls the latest conversations for the public observer', async () => {
    const gateway: PostGateway = {
      list: vi.fn<PostGateway['list']>().mockResolvedValue(response),
      getById: vi.fn<PostGateway['getById']>(),
    };
    const gateways: AppGateways = {
      worldGateway: unusedWorldGateway,
      postGateway: gateway,
      characterGateway: unusedCharacterGateway,
    };
    const client = new QueryClient();

    const { result } = renderHook(() => usePosts('mbti', 'hot'), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={client}>
          <GatewaysProvider value={gateways}>{children}</GatewaysProvider>
        </QueryClientProvider>
      ),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const query = client.getQueryCache().find({
      queryKey: ['posts', 'list', 'mbti', 'hot'],
    });

    const queryOptions = query?.options as { refetchInterval?: number };
    expect(queryOptions.refetchInterval).toBe(30_000);
  });
});

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
