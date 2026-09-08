import type { ListCharactersResponse } from '@aiworld/shared/schemas/character-response.schema';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { listCharacters } from '@/features/characters/api/character-api';

import { useAdminResidents } from './use-admin-residents';

vi.mock('@/features/characters/api/character-api', () => ({
  listCharacters: vi.fn<typeof listCharacters>(),
}));

const listCharactersMock = vi.mocked(listCharacters);
const response: ListCharactersResponse = {
  items: [],
  meta: {
    page: 1,
    limit: 100,
    total: 0,
    totalPages: 0,
  },
};

describe('useAdminResidents', () => {
  it('does not configure polling for the admin resident status view', async () => {
    listCharactersMock.mockResolvedValue(response);
    const client = new QueryClient();

    const { result } = renderHook(() => useAdminResidents('mbti-house'), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const query = client.getQueryCache().find({
      queryKey: [
        'characters',
        'list',
        {
          worldSlug: 'mbti-house',
          page: 1,
          limit: 100,
          isActive: true,
        },
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
