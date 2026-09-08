import { useQuery } from '@tanstack/react-query';

import {
  POLLING_OPTIONS,
  PUBLIC_POLL_INTERVAL_MS,
} from '@/core/query/public-polling';
import { getWorldBySlug } from '@/features/worlds/api/world-api';

import { worldKeys } from './world-keys';

export interface UseWorldOptions {
  /** Enable the public observer refresh cadence for this query. */
  polling?: boolean;
}

/** Public detail polling and empty-slug gating preserve route-level behavior. */
export function useWorld(
  slug: string,
  { polling = false }: UseWorldOptions = {},
) {
  return useQuery({
    queryKey: worldKeys.detail(slug),
    queryFn: () => getWorldBySlug(slug),
    enabled: slug.length > 0,
    ...(polling
      ? {
          refetchInterval: PUBLIC_POLL_INTERVAL_MS,
          ...POLLING_OPTIONS,
        }
      : {}),
  });
}
