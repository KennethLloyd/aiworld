import type { ListWorldsQuery } from '@aiworld/shared/schemas/world.schema';
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import {
  POLLING_OPTIONS,
  PUBLIC_POLL_INTERVAL_MS,
} from '@/core/query/public-polling';
import { listWorlds } from '@/features/worlds/api/world-api';

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
  return useQuery({
    queryKey: worldKeys.list(query),
    queryFn: () => listWorlds(query),
    placeholderData: keepPreviousData,
    ...(polling
      ? {
          refetchInterval: PUBLIC_POLL_INTERVAL_MS,
          ...POLLING_OPTIONS,
        }
      : {}),
  });
}
