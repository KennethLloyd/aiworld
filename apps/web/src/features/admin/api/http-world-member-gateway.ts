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

import type { HttpClient } from '@/core/api/http-client';

import { worldMemberEndpoints } from './world-member-endpoints';
import type { WorldMemberGateway } from './world-member-gateway';

/** HTTP adapter for the ADMIN-only WorldMember management port. */
export class HttpWorldMemberGateway implements WorldMemberGateway {
  constructor(private readonly http: HttpClient) {}

  async list(query: ListWorldMembersQuery): Promise<ListWorldMembersResponse> {
    const parsedQuery = listWorldMembersQuerySchema.parse(query);
    const raw = await this.http.get<unknown>(
      worldMemberEndpoints.list(parsedQuery),
    );
    return listWorldMembersResponseSchema.parse(raw);
  }

  async create(input: CreateWorldMember): Promise<WorldMemberResponse> {
    const body = createWorldMemberSchema.parse(input);
    const raw = await this.http.post<unknown>(
      worldMemberEndpoints.create(body),
      body,
    );
    return worldMemberResponseSchema.parse(raw);
  }

  async update(
    memberId: string,
    input: UpdateWorldMember,
  ): Promise<WorldMemberResponse> {
    const body = updateWorldMemberSchema.parse(input);
    const raw = await this.http.patch<unknown>(
      worldMemberEndpoints.update(memberId, body),
      body,
    );
    return worldMemberResponseSchema.parse(raw);
  }
}
