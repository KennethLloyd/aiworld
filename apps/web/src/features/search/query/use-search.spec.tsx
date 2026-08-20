import type { SearchResponse } from '@aiworld/shared/schemas/search-response.schema';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { CharacterGateway } from '@/features/characters/api/character-gateway';
import type { PostGateway } from '@/features/posts/api/post-gateway';
import type { WorldGateway } from '@/features/worlds/api/world-gateway';
import {
  GatewaysProvider,
  type AppGateways,
} from '@/providers/gateways-provider';
import { unusedAdminGateway } from '@/test/fixtures/unused-admin-gateway';
import { unusedAdminCharacterGateway } from '@/test/fixtures/unused-character-gateways';

import type { SearchGateway } from '../api/search-gateway';
import { useSearch } from './use-search';

const response: SearchResponse = {
  items: [],
  meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
};

describe('useSearch', () => {
  it('stays disabled until the query has two non-whitespace characters', async () => {
    const search = vi.fn<SearchGateway['search']>().mockResolvedValue(response);
    const client = new QueryClient();
    const { result, rerender } = renderHook(
      ({ value }: { value: string }) => useSearch('mbti', value),
      {
        initialProps: { value: 'a' },
        wrapper: ({ children }) => (
          <QueryClientProvider client={client}>
            <GatewaysProvider value={gateways({ search })}>
              {children}
            </GatewaysProvider>
          </QueryClientProvider>
        ),
      },
    );

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(search).not.toHaveBeenCalled();
    expect(result.current.isPending).toBe(true);

    rerender({ value: 'ab' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(search).toHaveBeenCalledWith('mbti', {
      q: 'ab',
      page: 1,
      limit: 20,
    });
  });
});

function gateways(searchGateway: SearchGateway): AppGateways {
  return {
    adminGateway: unusedAdminGateway,
    worldGateway: unusedWorldGateway,
    postGateway: unusedPostGateway,
    characterGateway: unusedCharacterGateway,
    adminCharacterGateway: unusedAdminCharacterGateway,
    searchGateway,
  };
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
