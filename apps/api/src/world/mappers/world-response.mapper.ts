import { Paginated } from '@aiworld/shared/schemas/pagination.schema';
import {
  WorldResponse,
  ListWorldsResponse,
} from '@aiworld/shared/schemas/world-response.schema';

import { WorldView } from '@/world/world.service';

export function mapWorldResponse(world: WorldView): WorldResponse {
  return {
    ...world,
    createdAt: world.createdAt.toISOString(),
    updatedAt: world.updatedAt.toISOString(),
  };
}

export function mapPaginatedWorldResponse(
  paginatedWorlds: Paginated<WorldView>,
): ListWorldsResponse {
  const mappedItems: WorldResponse[] = paginatedWorlds.items.map((item) => ({
    ...item,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  }));

  return {
    ...paginatedWorlds,
    items: mappedItems,
  };
}
