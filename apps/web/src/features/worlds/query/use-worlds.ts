import type { ListWorldsQuery } from '@aiworld/shared/schemas/world.schema';
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { PUBLIC_POLL_INTERVAL_MS } from '@/core/query/public-polling';
import { useGateways } from '@/providers/gateways-provider';

import { worldKeys } from './world-keys';

/** World list query; public routes opt into polling, admin lists remain manual. */
export interface UseWorldsOptions {
  /** Enable the public observer refresh cadence; admin lists stay manual. */
  polling?: boolean;
}

export function useWorlds(
  query: ListWorldsQuery,
  { polling = false }: UseWorldsOptions = {},
) {
  const { worldGateway } = useGateways();
  return useQuery({
    queryKey: worldKeys.list(query),
    queryFn: () => worldGateway.list(query),
    placeholderData: keepPreviousData,
    ...(polling
      ? {
          refetchInterval: PUBLIC_POLL_INTERVAL_MS,
          refetchIntervalInBackground: true,
        }
      : {}),
  });
}
