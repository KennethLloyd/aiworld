import { Paginated } from '@aiworld/shared/schemas/pagination.schema';
import {
  CreateWorldMember,
  ListWorldMembersQuery,
  UpdateWorldMember,
} from '@aiworld/shared/schemas/world-member.schema';
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { Prisma, WorldMember } from '@/generated/prisma/client';
import { PrismaService } from '@/lib/database/prisma.service';
import { WorldMemberRecord } from '@/world-members/domain/world-member-record';
import { WorldMemberRepository } from '@/world-members/repositories/world-member-repository.interface';

type WorldMemberWithWorld = WorldMember & { world: { slug: string } };

@Injectable()
export class PrismaWorldMemberRepository extends WorldMemberRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  private mapToRecord(member: WorldMemberWithWorld): WorldMemberRecord {
    return {
      id: member.id,
      worldId: member.worldId,
      worldSlug: member.world.slug,
      characterId: member.characterId,
      userId: member.userId,
      role: member.role,
      isActive: member.isActive,
      joinedAt: member.joinedAt,
    };
  }

  async findAll(
    query: ListWorldMembersQuery,
  ): Promise<Paginated<WorldMemberRecord>> {
    const { worldSlug, characterId, userId, role, isActive, page, limit } =
      query;
    const where: Prisma.WorldMemberWhereInput = {
      world: worldSlug ? { slug: worldSlug } : undefined,
      characterId,
      userId,
      role,
      isActive,
    };
    const include = { world: { select: { slug: true } } } as const;

    const [items, total] = await Promise.all([
      this.prisma.worldMember.findMany({
        where,
        include,
        orderBy: [{ joinedAt: 'asc' }, { id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.worldMember.count({ where }),
    ]);

    return {
      items: items.map((item) =>
        this.mapToRecord(item as WorldMemberWithWorld),
      ),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string): Promise<WorldMemberRecord | null> {
    const member = await this.prisma.worldMember.findUnique({
      where: { id },
      include: { world: { select: { slug: true } } },
    });

    return member ? this.mapToRecord(member as WorldMemberWithWorld) : null;
  }

  async findByWorldAndCharacter(
    worldId: string,
    characterId: string,
  ): Promise<{ id: string } | null> {
    const member = await this.prisma.worldMember.findFirst({
      where: { worldId, characterId },
      select: { id: true },
    });

    return member;
  }

  async findActiveByWorldAndCharacter(
    worldId: string,
    characterId: string,
  ): Promise<{ id: string } | null> {
    const member = await this.prisma.worldMember.findFirst({
      where: { worldId, characterId, isActive: true },
      select: { id: true },
    });

    return member;
  }

  async create(input: CreateWorldMember): Promise<WorldMemberRecord> {
    const { worldSlug, characterId, userId, isActive } = input;
    const world = await this.prisma.world.findUnique({
      where: { slug: worldSlug },
    });
    if (!world) {
      throw new NotFoundException('World not found');
    }

    try {
      const member = await this.prisma.worldMember.create({
        data: {
          worldId: world.id,
          characterId,
          userId,
          role: characterId ? 'AI' : 'HUMAN',
          isActive: isActive ?? true,
        },
        include: { world: { select: { slug: true } } },
      });

      return this.mapToRecord(member as WorldMemberWithWorld);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'The principal is already a member of this World',
        );
      }
      throw error;
    }
  }

  async update(
    id: string,
    input: UpdateWorldMember,
  ): Promise<WorldMemberRecord | null> {
    const member = await this.prisma.$transaction(
      async (transaction) => {
        const existing = await transaction.worldMember.findUnique({
          where: { id },
        });
        if (!existing) {
          return null;
        }

        const updated = await transaction.worldMember.update({
          where: { id },
          data: input,
          include: { world: { select: { slug: true } } },
        });
        if (existing.isActive === input.isActive) {
          return updated as WorldMemberWithWorld;
        }

        const votes = await transaction.vote.findMany({
          where: { authorMemberId: id, postId: { not: null } },
          select: { postId: true, value: true },
          orderBy: { postId: 'asc' },
        });
        for (const vote of votes) {
          await transaction.post.update({
            where: { id: vote.postId! },
            data: {
              voteScore: {
                increment: input.isActive ? vote.value : -vote.value,
              },
            },
          });
        }
        return updated as WorldMemberWithWorld;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return member ? this.mapToRecord(member) : null;
  }
}
