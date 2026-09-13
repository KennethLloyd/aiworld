import { useQuery } from '@tanstack/react-query';

import { getWorldNarrative } from '@/features/worlds/api/world-api';

import { worldKeys } from './world-keys';

export function useWorldNarrative(slug: string) {
  return useQuery({
    queryKey: worldKeys.narrative(slug),
    queryFn: () => getWorldNarrative(slug),
    enabled: slug.length > 0,
    refetchInterval: (query) =>
      query.state.data?.recentEvents !== null &&
      query.state.data?.storySoFar !== null
        ? false
        : 3000,
    refetchIntervalInBackground: false,
  });
}
