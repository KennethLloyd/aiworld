import { Paginated } from '@aiworld/shared/schemas/pagination.schema';
import {
  CreateWorldMember,
  ListWorldMembersQuery,
  UpdateWorldMember,
} from '@aiworld/shared/schemas/world-member.schema';

import { WorldMemberRecord } from '@/world-members/domain/world-member-record';

export abstract class WorldMemberRepository {
  abstract findAll(
    query: ListWorldMembersQuery,
  ): Promise<Paginated<WorldMemberRecord>>;
  abstract findById(id: string): Promise<WorldMemberRecord | null>;
  abstract create(input: CreateWorldMember): Promise<WorldMemberRecord>;
  abstract update(
    id: string,
    input: UpdateWorldMember,
  ): Promise<WorldMemberRecord | null>;
}
