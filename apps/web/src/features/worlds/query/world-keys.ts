import type { ListWorldsQuery } from '@aiworld/shared/schemas/world.schema';

/**
 * Query key factory - the only place world keys are spelled. No inline
 * ['worlds', ...] arrays anywhere else; filters (page/limit/search) are part
 * of the list key so each distinct query caches separately and list
 * invalidation via `lists()` covers every filter combination.
 */
export const worldKeys = {
  all: ['worlds'] as const,
  lists: () => [...worldKeys.all, 'list'] as const,
  list: (query: ListWorldsQuery) => [...worldKeys.lists(), query] as const,
  details: () => [...worldKeys.all, 'detail'] as const,
  detail: (slug: string) => [...worldKeys.details(), slug] as const,
};
