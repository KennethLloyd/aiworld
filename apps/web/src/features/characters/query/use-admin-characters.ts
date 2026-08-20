import type { ListCharactersQuery } from '@aiworld/shared/schemas/character.schema';
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { useGateways } from '@/providers/gateways-provider';

import { characterKeys } from './character-keys';

const adminCharactersQuery: ListCharactersQuery = {
  page: 1,
  limit: 20,
};

/** Loads the complete admin Character registry, including inactive/unassigned records. */
export function useAdminCharacters(
  query: ListCharactersQuery = adminCharactersQuery,
) {
  const { adminCharacterGateway } = useGateways();
  return useQuery({
    queryKey: characterKeys.adminList(query),
    queryFn: () => adminCharacterGateway.listAdmin(query),
    placeholderData: keepPreviousData,
  });
}
