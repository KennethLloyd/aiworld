import type { ListCharactersQuery } from '@aiworld/shared/schemas/character.schema';

export const characterKeys = {
  all: ['characters'] as const,
  lists: () => [...characterKeys.all, 'list'] as const,
  list: (query: ListCharactersQuery) =>
    [...characterKeys.lists(), query] as const,
  details: () => [...characterKeys.all, 'detail'] as const,
  detail: (characterId: string) =>
    [...characterKeys.details(), characterId] as const,
  activities: () => [...characterKeys.all, 'activity'] as const,
  activity: (worldSlug: string, characterId: string) =>
    [...characterKeys.activities(), worldSlug, characterId] as const,
};
