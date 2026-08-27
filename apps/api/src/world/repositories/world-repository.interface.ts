import { Paginated } from '@aiworld/shared/schemas/pagination.schema';
import {
  CreateWorld,
  ListWorldsQuery,
  UpdateWorld,
} from '@aiworld/shared/schemas/world.schema';

import { WorldRecord } from '@/world/domain/world-record';

export type ActiveSimulationLockResult<T> =
  | { status: 'executed'; value: T }
  | { status: 'inactive' }
  | { status: 'missing' };

export abstract class WorldRepository {
  abstract findAll(query: ListWorldsQuery): Promise<Paginated<WorldRecord>>;
  abstract findBySlug(
    slug: string,
    isActive?: boolean,
  ): Promise<WorldRecord | null>;
  abstract findById(id: string): Promise<WorldRecord | null>;
  abstract create(data: CreateWorld): Promise<WorldRecord>;
  abstract update(slug: string, data: UpdateWorld): Promise<WorldRecord | null>;
  abstract delete(slug: string): Promise<void>;
  /** Runs a short simulation operation while the World-specific advisory lock
   * is held. The operation is skipped when the World is missing or inactive. */
  abstract withActiveSimulationLock<T>(
    worldId: string,
    operation: () => Promise<T>,
  ): Promise<ActiveSimulationLockResult<T>>;
}
