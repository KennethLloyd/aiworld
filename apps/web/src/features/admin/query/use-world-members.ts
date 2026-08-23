import type { WorldMemberResponse } from '@aiworld/shared/schemas/world-member-response.schema';
import type { ListWorldMembersQuery } from '@aiworld/shared/schemas/world-member.schema';
import { useQuery } from '@tanstack/react-query';

import { useGateways } from '@/providers/gateways-provider';

import type { WorldMemberGateway } from '../api/world-member-gateway';
import { worldMemberKeys } from './world-member-keys';

const WORLD_MEMBER_PAGE_SIZE = 100;

/** Reads every AI membership page so World-unassigned filtering is complete. */
export async function listAllAiWorldMembers(
  gateway: Pick<WorldMemberGateway, 'list'>,
  worldSlug: string,
): Promise<WorldMemberResponse[]> {
  const members: WorldMemberResponse[] = [];
  let page = 1;

  while (true) {
    const query: ListWorldMembersQuery = {
      worldSlug,
      role: 'AI',
      page,
      limit: WORLD_MEMBER_PAGE_SIZE,
    };
    const response = await gateway.list(query);
    members.push(...response.items);
    if (page >= response.meta.totalPages) {
      return members;
    }
    page += 1;
  }
}

export function useWorldMembers(worldSlug: string) {
  const { worldMemberGateway } = useGateways();
  return useQuery({
    queryKey: worldMemberKeys.world(worldSlug),
    queryFn: () => listAllAiWorldMembers(worldMemberGateway, worldSlug),
    enabled: worldSlug.length > 0,
  });
}
