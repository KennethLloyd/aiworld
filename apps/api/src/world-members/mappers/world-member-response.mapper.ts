import { Paginated } from '@aiworld/shared/schemas/pagination.schema';
import {
  ListWorldMembersResponse,
  WorldMemberResponse,
} from '@aiworld/shared/schemas/world-member-response.schema';

import { WorldMemberView } from '@/world-members/world-members.service';

export function mapWorldMemberResponse(
  member: WorldMemberView,
): WorldMemberResponse {
  return {
    ...member,
    joinedAt: member.joinedAt.toISOString(),
  };
}

export function mapPaginatedWorldMemberResponse(
  members: Paginated<WorldMemberView>,
): ListWorldMembersResponse {
  return {
    ...members,
    items: members.items.map(mapWorldMemberResponse),
  };
}
