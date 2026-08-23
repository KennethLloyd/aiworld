import type { ListCharactersQuery } from '@aiworld/shared/schemas/character.schema';

export const characterKeys = {
  all: ['characters'] as const,
  lists: () => [...characterKeys.all, 'list'] as const,
  list: (query: ListCharactersQuery) =>
    [...characterKeys.lists(), query] as const,
  adminLists: () => [...characterKeys.all, 'admin-list'] as const,
  adminList: (query: ListCharactersQuery) =>
    [...characterKeys.adminLists(), query] as const,
  adminDirectory: (query: Pick<ListCharactersQuery, 'search'> = {}) =>
    [...characterKeys.adminLists(), 'directory', query] as const,
  details: () => [...characterKeys.all, 'detail'] as const,
  detail: (characterId: string) =>
    [...characterKeys.details(), characterId] as const,
  adminDetails: () => [...characterKeys.all, 'admin-detail'] as const,
  adminDetail: (characterId: string) =>
    [...characterKeys.adminDetails(), characterId] as const,
  activities: () => [...characterKeys.all, 'activity'] as const,
  activity: (worldSlug: string, characterId: string) =>
    [...characterKeys.activities(), worldSlug, characterId] as const,
};
