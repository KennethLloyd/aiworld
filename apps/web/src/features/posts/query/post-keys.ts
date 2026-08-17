export const postKeys = {
  all: ['posts'] as const,
  list: (slug: string) => [...postKeys.all, 'list', slug] as const,
};
