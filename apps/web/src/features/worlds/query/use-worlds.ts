import type { ListWorldsQuery } from '@aiworld/shared/schemas/world.schema';
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { listWorlds } from '@/features/worlds/api/world-api';

import { worldKeys } from './world-keys';

/** World metadata stays manual/cache-driven for both public and admin lists. */
export function useWorlds(query: ListWorldsQuery) {
  return useQuery({
    queryKey: worldKeys.list(query),
    queryFn: () => listWorlds(query),
    placeholderData: keepPreviousData,
  });
}
