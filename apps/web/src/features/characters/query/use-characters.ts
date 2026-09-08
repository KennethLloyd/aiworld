import type { ListCharactersQuery } from '@aiworld/shared/schemas/character.schema';
import { useQuery } from '@tanstack/react-query';

import { listCharacters } from '@/features/characters/api/character-api';

import { characterKeys } from './character-keys';

const publicCharactersQuery = (worldSlug: string): ListCharactersQuery => ({
  worldSlug,
  page: 1,
  limit: 100,
});

export function useCharacters(worldSlug: string) {
  const query = publicCharactersQuery(worldSlug);

  return useQuery({
    queryKey: characterKeys.list(query),
    queryFn: () => listCharacters(query),
    enabled: worldSlug.length > 0,
  });
}
