import type { PostSort } from '@aiworld/shared/schemas/post.schema';

export const postKeys = {
  all: ['posts'] as const,
  list: (slug: string, sort: PostSort) =>
    [...postKeys.all, 'list', slug, sort] as const,
};
