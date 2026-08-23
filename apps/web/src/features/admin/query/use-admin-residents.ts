import type { ListCharactersQuery } from '@aiworld/shared/schemas/character.schema';
import { useQuery } from '@tanstack/react-query';

import { POLLING_OPTIONS } from '@/core/query/public-polling';
import { characterKeys } from '@/features/characters/query/character-keys';
import { useGateways } from '@/providers/gateways-provider';

import { ADMIN_POLL_INTERVAL_MS } from './use-simulation';

function activeResidentsQuery(worldSlug: string): ListCharactersQuery {
  return {
    worldSlug,
    page: 1,
    limit: 100,
    isActive: true,
  };
}

/** The status tab targets active AI Residents, not unscoped Characters. */
export function useAdminResidents(worldSlug: string) {
  const { characterGateway } = useGateways();
  const query = activeResidentsQuery(worldSlug);

  return useQuery({
    queryKey: characterKeys.list(query),
    queryFn: () => characterGateway.list(query),
    enabled: worldSlug.length > 0,
    refetchInterval: ADMIN_POLL_INTERVAL_MS,
    ...POLLING_OPTIONS,
  });
}
