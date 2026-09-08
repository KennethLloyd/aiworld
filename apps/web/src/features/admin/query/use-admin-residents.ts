import type { ListCharactersQuery } from '@aiworld/shared/schemas/character.schema';
import { useQuery } from '@tanstack/react-query';

import { listCharacters } from '@/features/characters/api/character-api';
import { characterKeys } from '@/features/characters/query/character-keys';

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
  const query = activeResidentsQuery(worldSlug);

  return useQuery({
    queryKey: characterKeys.list(query),
    queryFn: () => listCharacters(query),
    enabled: worldSlug.length > 0,
  });
}
