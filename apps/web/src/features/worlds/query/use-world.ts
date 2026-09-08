import { useQuery } from '@tanstack/react-query';

import { getWorldBySlug } from '@/features/worlds/api/world-api';

import { worldKeys } from './world-keys';

/** World metadata stays manual/cache-driven; empty slugs never fetch. */
export function useWorld(slug: string) {
  return useQuery({
    queryKey: worldKeys.detail(slug),
    queryFn: () => getWorldBySlug(slug),
    enabled: slug.length > 0,
  });
}
