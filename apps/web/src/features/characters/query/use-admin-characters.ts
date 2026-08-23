import type { AdminCharacterResponse } from '@aiworld/shared/schemas/character-response.schema';
import type { ListCharactersQuery } from '@aiworld/shared/schemas/character.schema';
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { useGateways } from '@/providers/gateways-provider';

import type { AdminCharacterGateway } from '../api/character-gateway';
import { characterKeys } from './character-keys';

const adminCharactersQuery: ListCharactersQuery = {
  page: 1,
  limit: 20,
};

/** Loads the complete admin Character registry, including inactive/unassigned records. */
export function useAdminCharacters(
  query: ListCharactersQuery = adminCharactersQuery,
  options: { enabled?: boolean } = {},
) {
  const { adminCharacterGateway } = useGateways();
  return useQuery({
    queryKey: characterKeys.adminList(query),
    queryFn: () => adminCharacterGateway.listAdmin(query),
    placeholderData: keepPreviousData,
    enabled: options.enabled ?? true,
  });
}

/** Loads the complete reusable Character directory for WorldMember joins. */
export function useAdminCharacterDirectory(
  options: { enabled?: boolean; search?: string } = {},
) {
  const { adminCharacterGateway } = useGateways();
  const search = options.search?.trim() || undefined;
  return useQuery({
    queryKey: characterKeys.adminDirectory({ search }),
    queryFn: () => listAllAdminCharacters(adminCharacterGateway, { search }),
    enabled: options.enabled ?? true,
  });
}

export async function listAllAdminCharacters(
  gateway: Pick<AdminCharacterGateway, 'listAdmin'>,
  query: Pick<ListCharactersQuery, 'search'> = {},
): Promise<AdminCharacterResponse[]> {
  const characters: AdminCharacterResponse[] = [];
  let page = 1;

  while (true) {
    const response = await gateway.listAdmin({
      page,
      limit: 100,
      search: query.search,
    });
    characters.push(...response.items);
    if (page >= response.meta.totalPages) {
      return characters;
    }
    page += 1;
  }
}
