import { Paginated } from '@aiworld/shared/schemas/pagination.schema';
import {
  WorldResponse,
  ListWorldsResponse,
} from '@aiworld/shared/schemas/world-response.schema';
import { Injectable } from '@nestjs/common';

import { WorldRecord } from '@/world/domain/world-record';

@Injectable()
export class WorldResponseMapper {
  mapToWorldResponse(record: WorldRecord): WorldResponse {
    return {
      ...record,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }

  mapToPaginatedWorldResponse(
    paginatedRecords: Paginated<WorldRecord>,
  ): ListWorldsResponse {
    const mappedItems: WorldResponse[] = paginatedRecords.items.map((item) => ({
      ...item,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    }));

    return {
      ...paginatedRecords,
      items: mappedItems,
    };
  }
}
