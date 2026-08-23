import type {
  ListWorldMembersResponse,
  WorldMemberResponse,
} from '@aiworld/shared/schemas/world-member-response.schema';
import type {
  CreateWorldMember,
  ListWorldMembersQuery,
  UpdateWorldMember,
} from '@aiworld/shared/schemas/world-member.schema';

export interface WorldMemberGateway {
  list(query: ListWorldMembersQuery): Promise<ListWorldMembersResponse>;
  create(input: CreateWorldMember): Promise<WorldMemberResponse>;
  update(
    memberId: string,
    input: UpdateWorldMember,
  ): Promise<WorldMemberResponse>;
}
