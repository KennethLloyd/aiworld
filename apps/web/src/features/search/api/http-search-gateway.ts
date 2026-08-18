import {
  searchResponseSchema,
  type SearchResponse,
} from '@aiworld/shared/schemas/search-response.schema';
import type { SearchQuery } from '@aiworld/shared/schemas/search.schema';

import type { HttpClient } from '@/core/api/http-client';

import { searchEndpoints } from './search-endpoints';
import type { SearchGateway } from './search-gateway';

export class HttpSearchGateway implements SearchGateway {
  constructor(private readonly http: HttpClient) {}

  async search(slug: string, query: SearchQuery): Promise<SearchResponse> {
    const raw = await this.http.get<unknown>(searchEndpoints.list(slug, query));
    return searchResponseSchema.parse(raw);
  }
}
