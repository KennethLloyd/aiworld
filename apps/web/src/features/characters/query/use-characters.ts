import type { ListCharactersQuery } from '@aiworld/shared/schemas/character.schema';
import { useQuery } from '@tanstack/react-query';

import { PUBLIC_POLL_INTERVAL_MS } from '@/core/query/public-polling';
import { useGateways } from '@/providers/gateways-provider';

import { characterKeys } from './character-keys';

const publicCharactersQuery = (worldSlug: string): ListCharactersQuery => ({
  worldSlug,
  page: 1,
  limit: 100,
});

export function useCharacters(worldSlug: string) {
  const { characterGateway } = useGateways();
  const query = publicCharactersQuery(worldSlug);

  return useQuery({
    queryKey: characterKeys.list(query),
    queryFn: () => characterGateway.list(query),
    enabled: worldSlug.length > 0,
    refetchInterval: PUBLIC_POLL_INTERVAL_MS,
    refetchIntervalInBackground: true,
  });
}
