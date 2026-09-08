import type { PostDetailResponse } from '@aiworld/shared/schemas/post-response.schema';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { getPostById } from '../api/post-api';
import { usePost } from './use-post';

vi.mock('../api/post-api', () => ({
  getPostById: vi.fn<typeof getPostById>(),
}));

const getPostByIdMock = vi.mocked(getPostById);
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
  it('calls the post API function for the requested detail', async () => {
    getPostByIdMock.mockResolvedValue(response);
    const client = new QueryClient();

    const { result } = renderHook(() => usePost('mbti', postId), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.title).toBe('A detail conversation');
    expect(getPostByIdMock).toHaveBeenCalledWith('mbti', postId);
  });

  it('polls the public post detail snapshot', async () => {
    getPostByIdMock.mockResolvedValue(response);
    const client = new QueryClient();

    const { result } = renderHook(() => usePost('mbti', postId), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const query = client.getQueryCache().find({
      queryKey: ['posts', 'detail', 'mbti', postId],
    });
    const queryOptions = query?.options as {
      refetchInterval?: number;
      refetchIntervalInBackground?: boolean;
    };
    expect(queryOptions.refetchInterval).toBe(5 * 60_000);
    expect(queryOptions.refetchIntervalInBackground).toBe(false);
  });
});
