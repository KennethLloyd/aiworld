import type { SearchResponse } from '@aiworld/shared/schemas/search-response.schema';
import type { SearchQuery } from '@aiworld/shared/schemas/search.schema';

export interface SearchGateway {
  search(slug: string, query: SearchQuery): Promise<SearchResponse>;
}
