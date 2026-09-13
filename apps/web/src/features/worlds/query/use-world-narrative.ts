import { useQuery } from '@tanstack/react-query';

import { POLLING_OPTIONS } from '@/core/query/public-polling';
import { getWorldNarrative } from '@/features/worlds/api/world-api';

export function useWorldNarrative(slug: string) {
  return useQuery({
    queryKey: ['worlds', slug, 'narrative'],
    queryFn: () => getWorldNarrative(slug),
    enabled: slug.length > 0,
    refetchInterval: 30_000,
    ...POLLING_OPTIONS,
  });
}
