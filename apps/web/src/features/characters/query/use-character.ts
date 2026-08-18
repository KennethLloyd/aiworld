import { useQuery } from '@tanstack/react-query';

import { PUBLIC_POLL_INTERVAL_MS } from '@/core/query/public-polling';
import { useGateways } from '@/providers/gateways-provider';

import { characterKeys } from './character-keys';

export function useCharacter(characterId: string) {
  const { characterGateway } = useGateways();

  return useQuery({
    queryKey: characterKeys.detail(characterId),
    queryFn: () => characterGateway.getById(characterId),
    enabled: characterId.length > 0,
    refetchInterval: PUBLIC_POLL_INTERVAL_MS,
    refetchIntervalInBackground: true,
  });
}
