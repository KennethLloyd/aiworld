import type {
  CreateWorldMember,
  ListWorldMembersQuery,
  UpdateWorldMember,
} from '@aiworld/shared/schemas/world-member.schema';

function appendQuery(
  path: string,
  query: Record<string, string | undefined>,
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) {
      params.set(key, value);
    }
  }
  const search = params.toString();
  return search.length > 0 ? `${path}?${search}` : path;
}

export const worldMemberEndpoints = {
  base(): string {
    return '/api/world-members';
  },
  list(query: ListWorldMembersQuery): string {
    return appendQuery(worldMemberEndpoints.base(), {
      worldSlug: query.worldSlug,
      characterId: query.characterId,
      userId: query.userId,
      role: query.role,
      page: String(query.page),
      limit: String(query.limit),
      isActive:
        query.isActive === undefined ? undefined : String(query.isActive),
    });
  },
  detail(memberId: string): string {
    return `${worldMemberEndpoints.base()}/${encodeURIComponent(memberId)}`;
  },
  create(_input: CreateWorldMember): string {
    return worldMemberEndpoints.base();
  },
  update(memberId: string, _input: UpdateWorldMember): string {
    return worldMemberEndpoints.detail(memberId);
  },
};
