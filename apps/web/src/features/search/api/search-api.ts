import {
  searchResponseSchema,
  type SearchResponse,
} from '@aiworld/shared/schemas/search-response.schema';
import type { SearchQuery } from '@aiworld/shared/schemas/search.schema';

import { apiClient } from '@/core/api/http-client';

import { searchEndpoints } from './search-endpoints';

export async function searchWorld(
  slug: string,
  query: SearchQuery,
): Promise<SearchResponse> {
  const raw = await apiClient.get<unknown>(searchEndpoints.list(slug, query));
  return searchResponseSchema.parse(raw);
}
