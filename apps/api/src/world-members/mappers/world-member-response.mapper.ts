import { Paginated } from '@aiworld/shared/schemas/pagination.schema';
import {
  ListWorldMembersResponse,
  WorldMemberResponse,
} from '@aiworld/shared/schemas/world-member-response.schema';
import { Injectable } from '@nestjs/common';

import { WorldMemberRecord } from '@/world-members/domain/world-member-record';

@Injectable()
export class WorldMemberResponseMapper {
  mapToWorldMemberResponse(record: WorldMemberRecord): WorldMemberResponse {
    return {
      ...record,
      joinedAt: record.joinedAt.toISOString(),
    };
  }

  mapToPaginatedWorldMemberResponse(
    records: Paginated<WorldMemberRecord>,
  ): ListWorldMembersResponse {
    return {
      ...records,
      items: records.items.map((item) => this.mapToWorldMemberResponse(item)),
    };
  }
}
