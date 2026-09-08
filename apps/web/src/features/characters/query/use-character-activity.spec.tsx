import type { CharacterActivityResponse } from '@aiworld/shared/schemas/activity-response.schema';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { getCharacterActivity } from '../api/character-api';
import { useCharacterActivity } from './use-character-activity';

vi.mock('../api/character-api', () => ({
  getCharacterActivity: vi.fn<typeof getCharacterActivity>(),
}));

const getCharacterActivityMock = vi.mocked(getCharacterActivity);
const characterId = '8a3f6f47-9a5c-4a0a-bc4d-1c0d9d3b2f12';
const firstPage: CharacterActivityResponse = {
  items: [
    {
      kind: 'post',
      id: '7a3f6f47-9a5c-4a0a-bc4d-1c0d9d3b2f11',
      title: 'The first conversation',
      content: 'A first post.',
      voteScore: 5,
      author: {
        id: characterId,
        handle: 'mystic_aura',
        name: 'Mystic Aura',
        avatarUrl: null,
        classification: 'INFJ',
        classificationGroup: 'NF',
      },
      createdAt: '2026-07-15T10:00:00.000Z',
      updatedAt: '2026-07-15T10:00:00.000Z',
    },
  ],
  nextCursor: 'cursor-2',
};
const secondPage: CharacterActivityResponse = {
  items: [
    {
      kind: 'comment',
      id: '9a3f6f47-9a5c-4a0a-bc4d-1c0d9d3b2f13',
      author: firstPage.items[0]!.author,
      content: 'A follow-up comment.',
      voteScore: 2,
      createdAt: '2026-07-14T10:00:00.000Z',
      updatedAt: '2026-07-14T10:00:00.000Z',
      replies: [],
      postId: '7a3f6f47-9a5c-4a0a-bc4d-1c0d9d3b2f11',
      postTitle: 'The first conversation',
    },
  ],
  nextCursor: null,
};

describe('useCharacterActivity', () => {
  it('loads activity pages through the feature API function', async () => {
    getCharacterActivityMock
      .mockResolvedValueOnce(firstPage)
      .mockResolvedValueOnce(secondPage);
    const client = new QueryClient();

    const { result } = renderHook(
      () => useCharacterActivity('mbti', characterId),
      {
        wrapper: ({ children }) => (
          <QueryClientProvider client={client}>{children}</QueryClientProvider>
        ),
      },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.pages).toHaveLength(1);
    expect(result.current.hasNextPage).toBe(true);

    await result.current.fetchNextPage();

    await waitFor(() => expect(result.current.data?.pages).toHaveLength(2));
    expect(result.current.data?.pages).toEqual([firstPage, secondPage]);
    expect(getCharacterActivityMock).toHaveBeenNthCalledWith(2, characterId, {
      worldSlug: 'mbti',
      limit: 20,
      cursor: 'cursor-2',
    });
    expect(result.current.hasNextPage).toBe(false);
  });

  it('does not poll the historical activity timeline', async () => {
    getCharacterActivityMock.mockResolvedValue(firstPage);
    const client = new QueryClient();

    const { result } = renderHook(
      () => useCharacterActivity('mbti', characterId),
      {
        wrapper: ({ children }) => (
          <QueryClientProvider client={client}>{children}</QueryClientProvider>
        ),
      },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const query = client.getQueryCache().find({
      queryKey: ['characters', 'activity', 'mbti', characterId],
    });
    const queryOptions = query?.options ?? {};
    expect(
      (queryOptions as { refetchInterval?: unknown }).refetchInterval,
    ).toBeUndefined();
    expect(
      (queryOptions as { refetchIntervalInBackground?: unknown })
        .refetchIntervalInBackground,
    ).toBeUndefined();
  });
});
