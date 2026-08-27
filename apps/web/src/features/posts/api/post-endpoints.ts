import type { ListPostsQuery } from '@aiworld/shared/schemas/post.schema';

export const postEndpoints = {
  list(slug: string, query: ListPostsQuery): string {
    const searchParams = new URLSearchParams({
      sort: query.sort,
      limit: String(query.limit),
    });
    if (query.cursor !== undefined) {
      searchParams.set('cursor', query.cursor);
    }
    return `/api/worlds/${encodeURIComponent(slug)}/posts?${searchParams.toString()}`;
  },
  detail(slug: string, postId: string): string {
    return `/api/worlds/${encodeURIComponent(slug)}/posts/${encodeURIComponent(postId)}`;
  },
};
