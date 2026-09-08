import {
  listWorldMembersResponseSchema,
  type ListWorldMembersResponse,
  worldMemberResponseSchema,
  type WorldMemberResponse,
} from '@aiworld/shared/schemas/world-member-response.schema';
import {
  createWorldMemberSchema,
  listWorldMembersQuerySchema,
  type CreateWorldMember,
  type ListWorldMembersQuery,
  updateWorldMemberSchema,
  type UpdateWorldMember,
} from '@aiworld/shared/schemas/world-member.schema';

import { apiClient } from '@/core/api/http-client';

import { worldMemberEndpoints } from './world-member-endpoints';

export async function listWorldMembers(
  query: ListWorldMembersQuery,
): Promise<ListWorldMembersResponse> {
  const parsedQuery = listWorldMembersQuerySchema.parse(query);
  const raw = await apiClient.get<unknown>(
    worldMemberEndpoints.list(parsedQuery),
  );
  return listWorldMembersResponseSchema.parse(raw);
}

export async function createWorldMember(
  input: CreateWorldMember,
): Promise<WorldMemberResponse> {
  const body = createWorldMemberSchema.parse(input);
  const raw = await apiClient.post<unknown>(
    worldMemberEndpoints.create(),
    body,
  );
  return worldMemberResponseSchema.parse(raw);
}

export async function updateWorldMember(
  memberId: string,
  input: UpdateWorldMember,
): Promise<WorldMemberResponse> {
  const body = updateWorldMemberSchema.parse(input);
  const raw = await apiClient.patch<unknown>(
    worldMemberEndpoints.update(memberId),
    body,
  );
  return worldMemberResponseSchema.parse(raw);
}
