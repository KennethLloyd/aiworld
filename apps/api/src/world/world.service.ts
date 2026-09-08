import { Paginated } from '@aiworld/shared/schemas/pagination.schema';
import {
  CreateWorld,
  ListWorldsQuery,
  UpdateWorld,
} from '@aiworld/shared/schemas/world.schema';
import { ConflictException, Inject, Injectable } from '@nestjs/common';

import { Prisma, World as PrismaWorld } from '@/generated/prisma/client';
import type { SimulationConfigDefaults } from '@/lib/config/simulation-config-defaults';
import { PrismaService } from '@/lib/database/prisma.service';
import { WORLD_SIMULATION_CONFIG_DEFAULTS } from '@/world/world.tokens';

export interface WorldView {
  id: string;
  name: string;
  slug: string;
  description: Record<string, string> | null;
  rules: string[];
  topicScope: string;
  residentCount: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

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
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.values(value).every((item) => typeof item === 'string')
  );
}

function isStringArray(value: Prisma.JsonValue): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === 'string')
  );
}

function mapWorld(world: PrismaWorld, residentCount = 0): WorldView {
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

@Injectable()
export class WorldService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(WORLD_SIMULATION_CONFIG_DEFAULTS)
    private readonly simulationDefaults: SimulationConfigDefaults,
  ) {}

  async list(
    query: ListWorldsQuery,
    isAdmin = false,
  ): Promise<Paginated<WorldView>> {
    const normalizedQuery = {
      ...query,
      search: query.search?.trim() || undefined,
    };

    const where: Prisma.WorldWhereInput = {
      ...(normalizedQuery.search
        ? {
            OR: [
              {
                name: {
                  contains: normalizedQuery.search,
                  mode: 'insensitive',
                },
              },
              {
                topicScope: {
                  contains: normalizedQuery.search,
                  mode: 'insensitive',
                },
              },
            ],
          }
        : {}),
      isActive: isAdmin ? normalizedQuery.isActive : true,
    };
    const [items, total] = await Promise.all([
      this.prisma.world.findMany({
        where,
        include: residentCountInclude,
        skip: (normalizedQuery.page - 1) * normalizedQuery.limit,
        take: normalizedQuery.limit,
      }),
      this.prisma.world.count({ where }),
    ]);

    return {
      items: items.map((world) => mapWorld(world, world._count?.members ?? 0)),
      meta: {
        page: normalizedQuery.page,
        limit: normalizedQuery.limit,
        total,
        totalPages: Math.ceil(total / normalizedQuery.limit),
      },
    };
  }

  async getBySlug(slug: string, isAdmin = false): Promise<WorldView | null> {
    const world = await this.prisma.world.findUnique({
      where: { slug },
      include: residentCountInclude,
    });
    if (!world || (!isAdmin && !world.isActive)) {
      return null;
    }
    return mapWorld(world, world._count?.members ?? 0);
  }

  async findById(id: string): Promise<WorldView | null> {
    const world = await this.prisma.world.findUnique({ where: { id } });
    return world ? mapWorld(world) : null;
  }

  async create(input: CreateWorld): Promise<WorldView> {
    const world = await this.prisma.$transaction(async (transaction) => {
      const created = await transaction.world.create({
        data: { ...input, description: input.description ?? Prisma.DbNull },
      });
      await transaction.worldSimulationConfig.create({
        data: {
          worldId: created.id,
          ...this.simulationDefaults,
          actionWeights: { ...this.simulationDefaults.actionWeights },
        },
      });
      return created;
    });
    return mapWorld(world);
  }

  async update(slug: string, input: UpdateWorld): Promise<WorldView | null> {
    const existing = await this.prisma.world.findUnique({
      where: { slug },
    });
    if (!existing) {
      return null;
    }

    const updateData = {
      ...input,
      description:
        input.description === undefined
          ? undefined
          : (input.description ?? Prisma.DbNull),
    };
    if (input.isActive === false) {
      const world = await this.prisma.$transaction(async (transaction) => {
        const current = await transaction.world.findUnique({ where: { slug } });
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
        return transaction.world.update({
          where: { id: current.id },
          data: updateData,
        });
      });
      return world ? mapWorld(world) : null;
    }

    const world = await this.prisma.world.update({
      where: { slug },
      data: updateData,
    });
    return mapWorld(world);
  }

  async delete(slug: string): Promise<void> {
    await this.prisma.world.delete({ where: { slug } });
  }
}
