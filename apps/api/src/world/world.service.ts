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

  list(query: ListWorldsQuery): Promise<Paginated<WorldRecord>> {
    return this.worldRepository.findAll({
      ...query,
      search: query.search?.trim() || undefined,
    });
  }

  getBySlug(slug: string): Promise<WorldRecord | null> {
    return this.worldRepository.findBySlug(slug);
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
