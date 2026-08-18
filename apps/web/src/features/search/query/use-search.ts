import type { SearchQuery } from '@aiworld/shared/schemas/search.schema';
import { useQuery } from '@tanstack/react-query';

import { useGateways } from '@/providers/gateways-provider';

import { searchKeys } from './search-keys';

export const MIN_SEARCH_QUERY_LENGTH = 2;

export function normalizeSearchQuery(value: string): string {
  return value.trim();
}

function buildSearchParams(query: string): SearchQuery {
  return { q: query, page: 1, limit: 20 };
}

export function useSearch(slug: string, value: string) {
  const { searchGateway } = useGateways();
  const query = normalizeSearchQuery(value);
  const enabled = slug.length > 0 && query.length >= MIN_SEARCH_QUERY_LENGTH;

  return useQuery({
    queryKey: searchKeys.list(slug, query),
    queryFn: () => searchGateway.search(slug, buildSearchParams(query)),
    enabled,
    staleTime: 30_000,
  });
}
