import {
  CreateCharacter,
  ListCharactersQuery,
  UpdateCharacter,
} from '@aiworld/shared/schemas/character.schema';
import { Paginated } from '@aiworld/shared/schemas/pagination.schema';
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { CharacterRecord } from '@/characters/domain/character-record';
import { CharacterRepository } from '@/characters/repositories/character-repository.interface';
import { Prisma, Character } from '@/generated/prisma/client';
import { PrismaService } from '@/lib/database/prisma.service';

function isStringArray(value: Prisma.JsonValue): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === 'string')
  );
}

@Injectable()
export class PrismaCharacterRepository extends CharacterRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  private mapToRecord(character: Character): CharacterRecord {
    return {
      id: character.id,
      handle: character.handle,
      name: character.name,
      classification: character.classification,
      classificationGroup: character.classificationGroup,
      avatarUrl: character.avatarUrl,
      biography: character.biography,
      traits: isStringArray(character.traits) ? character.traits : [],
      systemPrompt: character.systemPrompt,
      isActive: character.isActive,
      createdAt: character.createdAt,
      updatedAt: character.updatedAt,
    };
  }

  async findAll(
    query: ListCharactersQuery,
  ): Promise<Paginated<CharacterRecord>> {
    const {
      worldSlug,
      search,
      classification,
      classificationGroup,
      isActive,
      page,
      limit,
    } = query;
    const where: Prisma.CharacterWhereInput = {
      isActive,
      classification,
      classificationGroup,
      OR: search
        ? [
            { name: { contains: search, mode: 'insensitive' } },
            { handle: { contains: search, mode: 'insensitive' } },
          ]
        : undefined,
      memberships: worldSlug
        ? {
            some: {
              isActive: true,
              world: { slug: worldSlug },
            },
          }
        : undefined,
    };

    const [items, total] = await Promise.all([
      this.prisma.character.findMany({
        where,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.character.count({ where }),
    ]);

    return {
      items: items.map((item) => this.mapToRecord(item)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(
    id: string,
    isActive?: boolean,
  ): Promise<CharacterRecord | null> {
    const character = await this.prisma.character.findUnique({
      where: { id },
    });

    if (
      !character ||
      (isActive !== undefined && character.isActive !== isActive)
    ) {
      return null;
    }

    return this.mapToRecord(character);
  }

  async findWorldSlugs(id: string): Promise<string[]> {
    const memberships = await this.prisma.worldMember.findMany({
      where: { characterId: id },
      select: { world: { select: { slug: true } } },
    });

    return memberships.map((membership) => membership.world.slug);
  }

  async create(input: CreateCharacter): Promise<CharacterRecord> {
    const { worldSlug, ...characterInput } = input;

    try {
      const character = await this.prisma.$transaction(async (transaction) => {
        const created = await transaction.character.create({
          data: {
            ...characterInput,
            classification: characterInput.classification ?? null,
            classificationGroup: characterInput.classificationGroup ?? null,
            avatarUrl: characterInput.avatarUrl ?? null,
            traits: characterInput.traits,
          },
        });

        if (worldSlug) {
          const world = await transaction.world.findUnique({
            where: { slug: worldSlug },
          });

          if (!world) {
            throw new NotFoundException('World not found');
          }

          await transaction.worldMember.create({
            data: {
              worldId: world.id,
              characterId: created.id,
              role: 'AI',
            },
          });
        }

        return created;
      });

      return this.mapToRecord(character);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'A character with this handle already exists',
        );
      }
      throw error;
    }
  }

  async update(
    id: string,
    input: UpdateCharacter,
  ): Promise<CharacterRecord | null> {
    const existing = await this.prisma.character.findUnique({ where: { id } });
    if (!existing) {
      return null;
    }

    try {
      const character = await this.prisma.character.update({
        where: { id },
        data: {
          ...input,
          classification:
            input.classification === undefined
              ? undefined
              : (input.classification ?? null),
          classificationGroup:
            input.classificationGroup === undefined
              ? undefined
              : (input.classificationGroup ?? null),
          avatarUrl:
            input.avatarUrl === undefined
              ? undefined
              : (input.avatarUrl ?? null),
          traits: input.traits,
        },
      });

      return this.mapToRecord(character);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'A character with this handle already exists',
        );
      }
      throw error;
    }
  }
}
