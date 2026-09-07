import { Paginated } from '@aiworld/shared/schemas/pagination.schema';
import {
  CreateWorld,
  ListWorldsQuery,
  UpdateWorld,
} from '@aiworld/shared/schemas/world.schema';
import { ConflictException, Inject, Injectable } from '@nestjs/common';

import { Prisma, World } from '@/generated/prisma/client';
import type { SimulationConfigDefaults } from '@/lib/config/simulation-config-defaults';
import { PrismaService } from '@/lib/database/prisma.service';
import { WorldRecord } from '@/world/domain/world-record';
import {
  WORLD_SIMULATION_CONFIG_DEFAULTS,
  WorldRepository,
} from '@/world/repositories/world-repository.interface';

const residentMemberWhere: Prisma.WorldMemberWhereInput = {
  role: 'AI',
  isActive: true,
  character: { isActive: true },
};

const residentCountInclude = {
  _count: { select: { members: { where: residentMemberWhere } } },
} as const;

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
  constructor(
    private readonly prisma: PrismaService,
    @Inject(WORLD_SIMULATION_CONFIG_DEFAULTS)
    private readonly simulationDefaults: SimulationConfigDefaults,
  ) {
    super();
  }

  private mapToWorldRecord(world: World, residentCount = 0): WorldRecord {
    return {
      id: world.id,
      name: world.name,
      slug: world.slug,
      description: isStringRecord(world.description) ? world.description : null,
      rules: isStringArray(world.rules) ? world.rules : [],
      topicScope: world.topicScope,
      residentCount,
      isActive: world.isActive,
      createdAt: world.createdAt,
      updatedAt: world.updatedAt,
    };
  }

  async findAll(query: ListWorldsQuery): Promise<Paginated<WorldRecord>> {
    const { search, isActive, page, limit } = query;
    const searchFilter: Prisma.WorldWhereInput = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { topicScope: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {};

    const where: Prisma.WorldWhereInput = {
      ...searchFilter,
      isActive,
    };

    const [items, total] = await Promise.all([
      this.prisma.world.findMany({
        where,
        include: residentCountInclude,
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.world.count({ where }),
    ]);

    return {
      items: items.map((item) =>
        this.mapToWorldRecord(item, item._count?.members ?? 0),
      ),
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
      include: residentCountInclude,
    });

    // Filter the shared read so only ADMIN can observe inactive Worlds.
    if (!item || (isActive !== undefined && item.isActive !== isActive)) {
      return null;
    }

    return this.mapToWorldRecord(item, item._count?.members ?? 0);
  }

  async findById(id: string): Promise<WorldRecord | null> {
    const item = await this.prisma.world.findUnique({
      where: { id },
    });

    return item ? this.mapToWorldRecord(item) : null;
  }

  async create(data: CreateWorld): Promise<WorldRecord> {
    const item = await this.prisma.$transaction(async (transaction) => {
      const world = await transaction.world.create({
        data: {
          ...data,
          description: data.description ?? Prisma.DbNull,
        },
      });

      await transaction.worldSimulationConfig.create({
        data: {
          worldId: world.id,
          ...this.simulationDefaults,
          actionWeights: { ...this.simulationDefaults.actionWeights },
        },
      });

      return world;
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

    const updateData = {
      ...data,
      description:
        data.description === undefined
          ? undefined
          : (data.description ?? Prisma.DbNull),
    };

    if (data.isActive === false) {
      const item = await this.prisma.$transaction(async (transaction) => {
        const current = await transaction.world.findUnique({
          where: { slug },
        });
        if (!current) {
          return null;
        }

        const config = await transaction.worldSimulationConfig.findUnique({
          where: { worldId: current.id },
          select: { state: true },
        });
        if (config?.state === 'RUNNING') {
          throw new ConflictException(
            'Cannot deactivate a World while its simulation is RUNNING',
          );
        }

        const updatedWorld = await transaction.world.update({
          where: { id: current.id },
          data: updateData,
        });
        return updatedWorld;
      });

      return item ? this.mapToWorldRecord(item) : null;
    }

    const item = await this.prisma.world.update({
      where: { slug },
      data: updateData,
    });

    return this.mapToWorldRecord(item);
  }

  async delete(slug: string): Promise<void> {
    await this.prisma.world.delete({
      where: { slug },
    });
  }
}
