import type { ListWorldsQuery } from '@aiworld/shared/schemas/world.schema';
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { useGateways } from '@/providers/gateways-provider';

import { PUBLIC_POLL_INTERVAL_MS } from './use-world';
import { worldKeys } from './world-keys';

/**
 * Public list query. placeholderData keeps the previous grid visible while
 * search/pagination changes load (v5 keepPreviousData), so the UI never
 * flashes a blank state when the query key changes.
 */
export function useWorlds(query: ListWorldsQuery) {
  const { worldGateway } = useGateways();
  return useQuery({
    queryKey: worldKeys.list(query),
    queryFn: () => worldGateway.list(query),
    placeholderData: keepPreviousData,
    refetchInterval: PUBLIC_POLL_INTERVAL_MS,
    refetchIntervalInBackground: true,
  });
}
