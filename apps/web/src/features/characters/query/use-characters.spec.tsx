import type { ListCharactersResponse } from '@aiworld/shared/schemas/character-response.schema';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { listCharacters } from '../api/character-api';
import { useCharacters } from './use-characters';

vi.mock('../api/character-api', () => ({
  listCharacters: vi.fn<typeof listCharacters>(),
}));

const listCharactersMock = vi.mocked(listCharacters);
const response: ListCharactersResponse = {
  items: [
    {
      id: '8a3f6f47-9a5c-4a0a-bc4d-1c0d9d3b2f12',
      handle: 'mystic_aura',
      name: 'Mystic Aura',
      classification: 'INFJ',
      classificationGroup: 'NF',
      avatarUrl: null,
      biography: 'A thoughtful observer.',
      traits: ['curious', 'calm'],
      isActive: true,
      createdAt: '2026-07-15T10:00:00.000Z',
      updatedAt: '2026-07-15T10:00:00.000Z',
    },
  ],
  meta: {
    page: 1,
    limit: 100,
    total: 1,
    totalPages: 1,
  },
};

describe('useCharacters', () => {
  it('does not configure polling for the resident directory', async () => {
    listCharactersMock.mockResolvedValue(response);
    const client = new QueryClient();

    const { result } = renderHook(() => useCharacters('mbti-house'), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const query = client.getQueryCache().find({
      queryKey: [
        'characters',
        'list',
        { worldSlug: 'mbti-house', page: 1, limit: 100 },
      ],
    });
    const queryOptions = query?.options as {
      refetchInterval?: unknown;
      refetchIntervalInBackground?: unknown;
    };
    expect(queryOptions.refetchInterval).toBeUndefined();
    expect(queryOptions.refetchIntervalInBackground).toBeUndefined();
  });
});
