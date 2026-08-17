import type { ListPostsQuery } from '@aiworld/shared/schemas/post.schema';

export const postEndpoints = {
  list(slug: string, query: ListPostsQuery): string {
    const searchParams = new URLSearchParams({
      sort: query.sort,
      page: String(query.page),
      limit: String(query.limit),
    });
    return `/api/worlds/${encodeURIComponent(slug)}/posts?${searchParams.toString()}`;
  },
};
