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

import { Character, Prisma } from '@/generated/prisma/client';
import { PrismaService } from '@/lib/database/prisma.service';

export type CharacterView = Omit<Character, 'traits'> & { traits: string[] };

function isStringArray(value: Prisma.JsonValue): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === 'string')
  );
}

function mapCharacter(character: Character): CharacterView {
  return {
    ...character,
    traits: isStringArray(character.traits) ? character.traits : [],
  };
}

@Injectable()
export class CharactersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    query: ListCharactersQuery,
    isAdmin: boolean,
  ): Promise<Paginated<CharacterView>> {
    const normalizedQuery = {
      ...query,
      search: query.search?.trim() || undefined,
      classification: query.classification?.trim() || undefined,
      classificationGroup: query.classificationGroup?.trim() || undefined,
      isActive: isAdmin ? query.isActive : true,
    };
    const where: Prisma.CharacterWhereInput = {
      isActive: normalizedQuery.isActive,
      classification: normalizedQuery.classification,
      classificationGroup: normalizedQuery.classificationGroup,
      OR: normalizedQuery.search
        ? [
            {
              name: {
                contains: normalizedQuery.search,
                mode: 'insensitive',
              },
            },
            {
              handle: {
                contains: normalizedQuery.search,
                mode: 'insensitive',
              },
            },
          ]
        : undefined,
      memberships: normalizedQuery.worldSlug
        ? {
            some: {
              isActive: true,
              world: { slug: normalizedQuery.worldSlug },
            },
          }
        : undefined,
    };
    const [items, total] = await Promise.all([
      this.prisma.character.findMany({
        where,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        skip: (normalizedQuery.page - 1) * normalizedQuery.limit,
        take: normalizedQuery.limit,
      }),
      this.prisma.character.count({ where }),
    ]);
    return {
      items: items.map(mapCharacter),
      meta: {
        page: normalizedQuery.page,
        limit: normalizedQuery.limit,
        total,
        totalPages: Math.ceil(total / normalizedQuery.limit),
      },
    };
  }

  async getById(id: string, isAdmin: boolean): Promise<CharacterView | null> {
    const character = await this.prisma.character.findUnique({
      where: { id },
    });
    if (!character || (!isAdmin && !character.isActive)) {
      return null;
    }
    return mapCharacter(character);
  }

  async create(input: CreateCharacter): Promise<CharacterView> {
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
            data: { worldId: world.id, characterId: created.id, role: 'AI' },
          });
        }
        return created;
      });
      return mapCharacter(character);
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
  ): Promise<CharacterView | null> {
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
      return mapCharacter(character);
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
