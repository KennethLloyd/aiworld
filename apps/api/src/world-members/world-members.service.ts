import { Paginated } from '@aiworld/shared/schemas/pagination.schema';
import {
  CreateWorldMember,
  ListWorldMembersQuery,
  UpdateWorldMember,
} from '@aiworld/shared/schemas/world-member.schema';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { Prisma, WorldMember } from '@/generated/prisma/client';
import { PrismaService } from '@/lib/database/prisma.service';

export type WorldMemberView = Pick<
  WorldMember,
  'id' | 'worldId' | 'characterId' | 'userId' | 'role' | 'isActive' | 'joinedAt'
> & { worldSlug: string };

const memberSelect = {
  id: true,
  worldId: true,
  characterId: true,
  userId: true,
  role: true,
  isActive: true,
  joinedAt: true,
  world: { select: { slug: true } },
} as const;

type WorldMemberRow = Pick<
  WorldMember,
  'id' | 'worldId' | 'characterId' | 'userId' | 'role' | 'isActive' | 'joinedAt'
> & { world: { slug: string } };

function mapWorldMember(member: WorldMemberRow): WorldMemberView {
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

@Injectable()
export class WorldMembersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    query: ListWorldMembersQuery,
  ): Promise<Paginated<WorldMemberView>> {
    const { worldSlug, characterId, userId, role, isActive, page, limit } =
      query;
    const where: Prisma.WorldMemberWhereInput = {
      world: worldSlug ? { slug: worldSlug } : undefined,
      characterId,
      userId,
      role,
      isActive,
    };
    const [items, total] = await Promise.all([
      this.prisma.worldMember.findMany({
        where,
        select: memberSelect,
        orderBy: [{ joinedAt: 'asc' }, { id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.worldMember.count({ where }),
    ]);
    return {
      items: items.map(mapWorldMember),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getById(id: string): Promise<WorldMemberView | null> {
    const member = await this.prisma.worldMember.findUnique({
      where: { id },
      select: memberSelect,
    });
    return member ? mapWorldMember(member) : null;
  }

  async findByWorldAndCharacter(
    worldId: string,
    characterId: string,
  ): Promise<{ id: string } | null> {
    return this.prisma.worldMember.findFirst({
      where: { worldId, characterId },
      select: { id: true },
    });
  }

  async findActiveByWorldAndCharacter(
    worldId: string,
    characterId: string,
  ): Promise<{ id: string } | null> {
    return this.prisma.worldMember.findFirst({
      where: { worldId, characterId, isActive: true },
      select: { id: true },
    });
  }

  async create(input: CreateWorldMember): Promise<WorldMemberView> {
    if (input.characterId) {
      const character = await this.prisma.character.findUnique({
        where: { id: input.characterId },
        select: { id: true },
      });
      if (!character) {
        throw new BadRequestException('Character not found');
      }
    }

    const world = await this.prisma.world.findUnique({
      where: { slug: input.worldSlug },
      select: { id: true },
    });
    if (!world) {
      throw new NotFoundException('World not found');
    }

    try {
      const member = await this.prisma.worldMember.create({
        data: {
          worldId: world.id,
          characterId: input.characterId,
          userId: input.userId,
          role: input.characterId ? 'AI' : 'HUMAN',
          isActive: input.isActive ?? true,
        },
        select: memberSelect,
      });
      return mapWorldMember(member);
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
  ): Promise<WorldMemberView | null> {
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
          select: memberSelect,
        });
        if (existing.isActive === input.isActive) {
          return updated;
        }

        const votes = await transaction.vote.findMany({
          where: {
            authorMemberId: id,
            OR: [{ postId: { not: null } }, { commentId: { not: null } }],
          },
          select: { postId: true, commentId: true, value: true },
        });
        for (const vote of votes) {
          const scoreDelta = input.isActive ? vote.value : -vote.value;
          if (vote.postId) {
            await transaction.post.update({
              where: { id: vote.postId },
              data: { voteScore: { increment: scoreDelta } },
            });
          } else if (vote.commentId) {
            await transaction.comment.update({
              where: { id: vote.commentId },
              data: { voteScore: { increment: scoreDelta } },
            });
          }
        }
        return updated;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    return member ? mapWorldMember(member) : null;
  }
}
