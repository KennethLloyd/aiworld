import type { PostSort } from '@aiworld/shared/schemas/post.schema';

export const postKeys = {
  all: ['posts'] as const,
  list: (slug: string, sort: PostSort) =>
    [...postKeys.all, 'list', slug, sort] as const,
  detail: (slug: string, postId: string) =>
    [...postKeys.all, 'detail', slug, postId] as const,
};
