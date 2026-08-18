import type { ActivityQuery } from '@aiworld/shared/schemas/activity.schema';
import { useInfiniteQuery } from '@tanstack/react-query';

import { PUBLIC_POLL_INTERVAL_MS } from '@/core/query/public-polling';
import { useGateways } from '@/providers/gateways-provider';

import { characterKeys } from './character-keys';

const ACTIVITY_PAGE_SIZE = 20;

export function useCharacterActivity(worldSlug: string, characterId: string) {
  const { characterGateway } = useGateways();

  return useInfiniteQuery({
    queryKey: characterKeys.activity(worldSlug, characterId),
    queryFn: ({ pageParam }) => {
      const query: ActivityQuery = {
        worldSlug,
        limit: ACTIVITY_PAGE_SIZE,
        cursor: pageParam,
      };
      return characterGateway.getActivity(characterId, query);
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: worldSlug.length > 0 && characterId.length > 0,
    refetchInterval: PUBLIC_POLL_INTERVAL_MS,
    refetchIntervalInBackground: true,
  });
}
