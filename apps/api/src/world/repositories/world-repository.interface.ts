import { Paginated } from '@aiworld/shared/schemas/pagination.schema';
import {
  CreateWorld,
  ListWorldsQuery,
  UpdateWorld,
} from '@aiworld/shared/schemas/world.schema';

import { WorldRecord } from '@/world/domain/world-record';

export abstract class WorldRepository {
  abstract findAll(query: ListWorldsQuery): Promise<Paginated<WorldRecord>>;
  abstract findBySlug(slug: string): Promise<WorldRecord | null>;
  abstract create(data: CreateWorld): Promise<WorldRecord>;
  abstract update(slug: string, data: UpdateWorld): Promise<WorldRecord | null>;
  abstract delete(slug: string): Promise<void>;
}
