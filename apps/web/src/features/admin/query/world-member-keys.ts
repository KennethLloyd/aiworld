export const worldMemberKeys = {
  all: ['world-members'] as const,
  lists: () => [...worldMemberKeys.all, 'list'] as const,
  world: (worldSlug: string) =>
    [...worldMemberKeys.lists(), worldSlug] as const,
};
