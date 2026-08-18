export const searchKeys = {
  all: ['search'] as const,
  list: (slug: string, query: string) =>
    [...searchKeys.all, slug, query] as const,
};
