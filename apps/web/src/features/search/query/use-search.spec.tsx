import type { SearchResponse } from '@aiworld/shared/schemas/search-response.schema';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { searchWorld } from '../api/search-api';
import { useSearch } from './use-search';

vi.mock('../api/search-api', () => ({
  searchWorld: vi.fn<typeof searchWorld>(),
}));

const searchWorldMock = vi.mocked(searchWorld);
const response: SearchResponse = {
  items: [],
  meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
};

describe('useSearch', () => {
  it('stays disabled until the query has two non-whitespace characters', async () => {
    searchWorldMock.mockResolvedValue(response);
    const client = new QueryClient();
    const { result, rerender } = renderHook(
      ({ value }: { value: string }) => useSearch('mbti', value),
      {
        initialProps: { value: 'a' },
        wrapper: ({ children }) => (
          <QueryClientProvider client={client}>{children}</QueryClientProvider>
        ),
      },
    );

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(searchWorldMock).not.toHaveBeenCalled();
    expect(result.current.isPending).toBe(true);

    rerender({ value: 'ab' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(searchWorldMock).toHaveBeenCalledWith('mbti', {
      q: 'ab',
      page: 1,
      limit: 20,
    });
  });
});
