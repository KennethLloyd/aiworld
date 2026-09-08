import type { WorldMemberResponse } from '@aiworld/shared/schemas/world-member-response.schema';
import type { ListWorldMembersQuery } from '@aiworld/shared/schemas/world-member.schema';
import { useQuery } from '@tanstack/react-query';

import { listWorldMembers } from '@/features/admin/api/world-member-api';

import { worldMemberKeys } from './world-member-keys';

const WORLD_MEMBER_PAGE_SIZE = 100;

/** Reads every AI membership page so World-unassigned filtering is complete. */
export async function listAllAiWorldMembers(
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
    const response = await listWorldMembers(query);
    members.push(...response.items);
    if (page >= response.meta.totalPages) {
      return members;
    }
    page += 1;
  }
}

export function useWorldMembers(worldSlug: string) {
  return useQuery({
    queryKey: worldMemberKeys.world(worldSlug),
    queryFn: () => listAllAiWorldMembers(worldSlug),
    enabled: worldSlug.length > 0,
  });
}
