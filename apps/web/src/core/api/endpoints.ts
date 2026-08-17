import type { ListWorldsQuery } from '@aiworld/shared/schemas/world.schema';

/**
 * Central URL construction for the plural /api/worlds contract. Feature code
 * never builds API URLs itself and never calls fetch; it only calls gateway
 * adapters, which build their URLs through these helpers.
 */
export const endpoints = {
  worlds: {
    /** The plural collection URL (POST create). */
    base(): string {
      return '/api/worlds';
    },
    list(query?: ListWorldsQuery): string {
      const searchParams = new URLSearchParams();
      if (query) {
        if (query.search !== undefined && query.search !== '') {
          searchParams.set('search', query.search);
        }
        searchParams.set('page', String(query.page));
        searchParams.set('limit', String(query.limit));
        if (query.isActive !== undefined) {
          searchParams.set('isActive', String(query.isActive));
        }
      }
      const queryString = searchParams.toString();
      return queryString.length > 0
        ? `/api/worlds?${queryString}`
        : endpoints.worlds.base();
    },
    detail(slug: string): string {
      return `/api/worlds/${encodeURIComponent(slug)}`;
    },
  },
};
