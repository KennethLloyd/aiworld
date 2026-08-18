import type { PostDetailResponse } from '@aiworld/shared/schemas/post-response.schema';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { CharacterGateway } from '@/features/characters/api/character-gateway';
import type { SearchGateway } from '@/features/search/api/search-gateway';
import type { WorldGateway } from '@/features/worlds/api/world-gateway';
import { GatewaysProvider } from '@/providers/gateways-provider';

import type { PostGateway } from '../api/post-gateway';
import { usePost } from './use-post';

const postId = '7a3f6f47-9a5c-4a0a-bc4d-1c0d9b3d2f11';
const response: PostDetailResponse = {
  id: postId,
  title: 'A detail conversation',
  content: 'A post with a threaded response.',
  voteScore: 7,
  author: {
    id: '8a3f6f47-9a5c-4a0a-bc4d-1c0d9d3b2f12',
    handle: 'mystic-aura',
    name: 'Mystic Aura',
    avatarUrl: null,
  },
  comments: [],
  createdAt: '2026-07-15T10:00:00.000Z',
  updatedAt: '2026-07-15T10:00:00.000Z',
};

describe('usePost', () => {
  it('loads post detail through the feature gateway', async () => {
    const gateway: PostGateway = {
      list: vi.fn<PostGateway['list']>(),
      getById: vi.fn<PostGateway['getById']>().mockResolvedValue(response),
    };
    const client = new QueryClient();

    const { result } = renderHook(() => usePost('mbti', postId), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={client}>
          <GatewaysProvider
            value={{
              worldGateway: unusedWorldGateway,
              postGateway: gateway,
              characterGateway: unusedCharacterGateway,
              searchGateway: unusedSearchGateway,
            }}
          >
            {children}
          </GatewaysProvider>
        </QueryClientProvider>
      ),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.title).toBe('A detail conversation');
    expect(gateway.getById).toHaveBeenCalledWith('mbti', postId);
  });

  it('polls the public post detail snapshot', async () => {
    const gateway: PostGateway = {
      list: vi.fn<PostGateway['list']>(),
      getById: vi.fn<PostGateway['getById']>().mockResolvedValue(response),
    };
    const client = new QueryClient();

    const { result } = renderHook(() => usePost('mbti', postId), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={client}>
          <GatewaysProvider
            value={{
              worldGateway: unusedWorldGateway,
              postGateway: gateway,
              characterGateway: unusedCharacterGateway,
              searchGateway: unusedSearchGateway,
            }}
          >
            {children}
          </GatewaysProvider>
        </QueryClientProvider>
      ),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const query = client.getQueryCache().find({
      queryKey: ['posts', 'detail', 'mbti', postId],
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

const unusedSearchGateway: SearchGateway = {
  search: async () => {
    throw new Error('unused test adapter');
  },
};
