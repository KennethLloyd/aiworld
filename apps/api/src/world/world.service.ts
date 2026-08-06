import { Paginated } from '@aiworld/shared/schemas/pagination.schema';
import {
  CreateWorld,
  ListWorldsQuery,
  UpdateWorld,
} from '@aiworld/shared/schemas/world.schema';
import { Inject, Injectable } from '@nestjs/common';

import { WorldRecord } from '@/world/domain/world-record';
import { WorldRepository } from '@/world/repositories/world-repository.interface';

@Injectable()
export class WorldService {
  constructor(
    @Inject(WorldRepository)
    private readonly worldRepository: WorldRepository,
  ) {}

  list(
    query: ListWorldsQuery,
    isAdmin = true,
  ): Promise<Paginated<WorldRecord>> {
    const normalizedQuery = {
      ...query,
      search: query.search?.trim() || undefined,
    };

    return this.worldRepository.findAll(
      isAdmin ? normalizedQuery : { ...normalizedQuery, isActive: true },
    );
  }

  getBySlug(slug: string, isAdmin = true): Promise<WorldRecord | null> {
    return isAdmin
      ? this.worldRepository.findBySlug(slug)
      : this.worldRepository.findBySlug(slug, true);
  }

  create(input: CreateWorld): Promise<WorldRecord> {
    return this.worldRepository.create(input);
  }

  update(slug: string, input: UpdateWorld): Promise<WorldRecord | null> {
    return this.worldRepository.update(slug, input);
  }

  delete(slug: string): Promise<void> {
    return this.worldRepository.delete(slug);
  }
}
