import { useQuery } from '@tanstack/react-query';

import { getCharacterById } from '@/features/characters/api/character-api';

import { characterKeys } from './character-keys';

export function useCharacter(characterId: string) {
  return useQuery({
    queryKey: characterKeys.detail(characterId),
    queryFn: () => getCharacterById(characterId),
    enabled: characterId.length > 0,
  });
}
