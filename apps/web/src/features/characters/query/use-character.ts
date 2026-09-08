import { useQuery } from '@tanstack/react-query';

import {
  POLLING_OPTIONS,
  PUBLIC_POLL_INTERVAL_MS,
} from '@/core/query/public-polling';
import { getCharacterById } from '@/features/characters/api/character-api';

import { characterKeys } from './character-keys';

export function useCharacter(characterId: string) {
  return useQuery({
    queryKey: characterKeys.detail(characterId),
    queryFn: () => getCharacterById(characterId),
    enabled: characterId.length > 0,
    refetchInterval: PUBLIC_POLL_INTERVAL_MS,
    ...POLLING_OPTIONS,
  });
}
