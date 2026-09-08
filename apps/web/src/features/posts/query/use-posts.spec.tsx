import type { ListPostsResponse } from '@aiworld/shared/schemas/post-response.schema';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { listPosts } from '../api/post-api';
import { usePosts } from './use-posts';

vi.mock('../api/post-api', () => ({
  listPosts: vi.fn<typeof listPosts>(),
}));

const listPostsMock = vi.mocked(listPosts);
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
  nextCursor: null,
};

describe('usePosts', () => {
  beforeEach(() => {
    listPostsMock.mockReset();
  });

  it('calls the post API function with the feed query and signal', async () => {
    listPostsMock.mockResolvedValue(response);
    const client = new QueryClient();

    const { result } = renderHook(() => usePosts('mbti', 'new'), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.pages[0]?.items[0]?.title).toBe(
      'A latest conversation',
    );
    expect(listPostsMock).toHaveBeenCalledWith(
      'mbti',
      { sort: 'new', limit: 5, cursor: undefined },
      expect.any(AbortSignal),
    );
  });

  it('requests the next cursor page once and preserves the page boundary', async () => {
    listPostsMock.mockImplementation(async (_slug, query) =>
      query.cursor === undefined
        ? { ...response, nextCursor: 'cursor-2' }
        : response,
    );
    const client = new QueryClient();

    const { result } = renderHook(() => usePosts('mbti', 'new'), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await act(async () => {
      await result.current.fetchNextPage();
    });

    await waitFor(() => expect(result.current.data?.pages).toHaveLength(2));
    expect(listPostsMock).toHaveBeenCalledTimes(2);
    expect(listPostsMock).toHaveBeenLastCalledWith(
      'mbti',
      { sort: 'new', limit: 5, cursor: 'cursor-2' },
      expect.any(AbortSignal),
    );
  });

  it('polls the latest conversations for the public observer', async () => {
    listPostsMock.mockResolvedValue(response);
    const client = new QueryClient();

    const { result } = renderHook(() => usePosts('mbti', 'hot'), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
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
