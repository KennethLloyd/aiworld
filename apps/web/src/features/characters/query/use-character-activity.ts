import type { ActivityQuery } from '@aiworld/shared/schemas/activity.schema';
import { useInfiniteQuery } from '@tanstack/react-query';

import { getCharacterActivity } from '@/features/characters/api/character-api';

import { characterKeys } from './character-keys';

const ACTIVITY_PAGE_SIZE = 20;

export function useCharacterActivity(worldSlug: string, characterId: string) {
  return useInfiniteQuery({
    queryKey: characterKeys.activity(worldSlug, characterId),
    queryFn: ({ pageParam }) => {
      const query: ActivityQuery = {
        worldSlug,
        limit: ACTIVITY_PAGE_SIZE,
        cursor: pageParam,
      };
      return getCharacterActivity(characterId, query);
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: worldSlug.length > 0 && characterId.length > 0,
    // Historical activity refreshes through the route's explicit control.
  });
}
