import { useQuery } from '@tanstack/react-query';

import { PUBLIC_POLL_INTERVAL_MS } from '@/core/query/public-polling';
import { useGateways } from '@/providers/gateways-provider';

import { worldKeys } from './world-keys';

export interface UseWorldOptions {
  /** Enable the public observer refresh cadence for this query. */
  polling?: boolean;
}

/**
 * World detail query. The public route opts into polling; admin detail keeps
 * the default manual refresh behavior. `enabled` keeps a disabled query
 * (never fired) while the slug is empty; 404s surface as ApiError(404) which
 * the route maps to the not-found state.
 */
export function useWorld(
  slug: string,
  { polling = false }: UseWorldOptions = {},
) {
  const { worldGateway } = useGateways();
  return useQuery({
    queryKey: worldKeys.detail(slug),
    queryFn: () => worldGateway.getBySlug(slug),
    enabled: slug.length > 0,
    ...(polling
      ? {
          refetchInterval: PUBLIC_POLL_INTERVAL_MS,
          refetchIntervalInBackground: true,
        }
      : {}),
  });
}
