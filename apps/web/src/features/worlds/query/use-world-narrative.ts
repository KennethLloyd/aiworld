import { useQuery } from '@tanstack/react-query';

import {
  POLLING_OPTIONS,
  PUBLIC_FEED_POLL_INTERVAL_MS,
} from '@/core/query/public-polling';
import { getWorldNarrative } from '@/features/worlds/api/world-narrative-api';

export const worldNarrativeKeys = {
  all: ['world-narrative'] as const,
  detail: (slug: string) => [...worldNarrativeKeys.all, slug] as const,
};

export function useWorldNarrative(slug: string) {
  return useQuery({
    queryKey: worldNarrativeKeys.detail(slug),
    queryFn: () => getWorldNarrative(slug),
    enabled: slug.length > 0,
    refetchInterval: PUBLIC_FEED_POLL_INTERVAL_MS,
    ...POLLING_OPTIONS,
  });
}
