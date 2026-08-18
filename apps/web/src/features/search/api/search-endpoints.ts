import type { SearchQuery } from '@aiworld/shared/schemas/search.schema';

export const searchEndpoints = {
  list(slug: string, query: SearchQuery): string {
    const searchParams = new URLSearchParams();
    if (query.q !== undefined) {
      searchParams.set('q', query.q);
    }
    searchParams.set('page', String(query.page));
    searchParams.set('limit', String(query.limit));
    return `/api/worlds/${encodeURIComponent(slug)}/search?${searchParams.toString()}`;
  },
};
