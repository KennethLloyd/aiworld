import { Paginated } from '@aiworld/shared/schemas/pagination.schema';
import {
  CreateWorld,
  ListWorldsQuery,
  UpdateWorld,
} from '@aiworld/shared/schemas/world.schema';
import { Injectable } from '@nestjs/common';

import { Prisma, World } from '@/generated/prisma/client';
import { PrismaService } from '@/lib/database/prisma.service';
import { WorldRecord } from '@/world/domain/world-record';
import { WorldRepository } from '@/world/repositories/world-repository.interface';

function isStringRecord(
  value: Prisma.JsonValue | null,
): value is Record<string, string> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  return Object.values(value).every((item) => typeof item === 'string');
}

function isStringArray(value: Prisma.JsonValue): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === 'string')
  );
}

@Injectable()
export class PrismaWorldRepository extends WorldRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  private mapToWorldRecord(world: World): WorldRecord {
    return {
      id: world.id,
      name: world.name,
      slug: world.slug,
      description: isStringRecord(world.description) ? world.description : null,
      rules: isStringArray(world.rules) ? world.rules : [],
      topicScope: world.topicScope,
      isActive: world.isActive,
      createdAt: world.createdAt,
      updatedAt: world.updatedAt,
    };
  }

  async findAll(query: ListWorldsQuery): Promise<Paginated<WorldRecord>> {
    const { search, isActive, page, limit } = query;

    const where: Prisma.WorldWhereInput = {
      name: search ? { contains: search, mode: 'insensitive' } : undefined,
      isActive,
    };

    const [items, total] = await Promise.all([
      this.prisma.world.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.world.count({ where }),
    ]);

    return {
      items: items.map((item) => this.mapToWorldRecord(item)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findBySlug(
    slug: string,
    isActive?: boolean,
  ): Promise<WorldRecord | null> {
    const item = await this.prisma.world.findUnique({
      where: { slug },
    });

    // The active check is applied to the fetched record instead of the Prisma
    // query so ADMIN and public callers share one read while only ADMIN can
    // observe inactive Worlds.
    if (!item || (isActive !== undefined && item.isActive !== isActive)) {
      return null;
    }

    return this.mapToWorldRecord(item);
  }

  async create(data: CreateWorld): Promise<WorldRecord> {
    const item = await this.prisma.world.create({
      data: {
        ...data,
        description: data.description ?? Prisma.DbNull,
      },
    });

    return this.mapToWorldRecord(item);
  }

  async update(slug: string, data: UpdateWorld): Promise<WorldRecord | null> {
    const existing = await this.prisma.world.findUnique({
      where: { slug },
    });

    if (!existing) {
      return null;
    }

    const item = await this.prisma.world.update({
      where: { slug },
      data: {
        ...data,
        description:
          data.description === undefined
            ? undefined
            : (data.description ?? Prisma.DbNull),
      },
    });

    return this.mapToWorldRecord(item);
  }

  async delete(slug: string): Promise<void> {
    await this.prisma.world.delete({
      where: { slug },
    });
  }
}
