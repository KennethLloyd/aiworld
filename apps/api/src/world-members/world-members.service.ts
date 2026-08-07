import { Paginated } from '@aiworld/shared/schemas/pagination.schema';
import {
  CreateWorldMember,
  ListWorldMembersQuery,
  UpdateWorldMember,
} from '@aiworld/shared/schemas/world-member.schema';
import { BadRequestException, Injectable } from '@nestjs/common';

import { CharacterRepository } from '@/characters/repositories/character-repository.interface';
import { WorldMemberRecord } from '@/world-members/domain/world-member-record';
import { WorldMemberRepository } from '@/world-members/repositories/world-member-repository.interface';

@Injectable()
export class WorldMembersService {
  constructor(
    private readonly worldMemberRepository: WorldMemberRepository,
    private readonly characterRepository: CharacterRepository,
  ) {}

  list(query: ListWorldMembersQuery): Promise<Paginated<WorldMemberRecord>> {
    return this.worldMemberRepository.findAll(query);
  }

  getById(id: string): Promise<WorldMemberRecord | null> {
    return this.worldMemberRepository.findById(id);
  }

  async create(input: CreateWorldMember): Promise<WorldMemberRecord> {
    if (input.characterId) {
      const character = await this.characterRepository.findById(
        input.characterId,
      );
      if (!character) {
        throw new BadRequestException('Character not found');
      }
    }

    return this.worldMemberRepository.create(input);
  }

  update(
    id: string,
    input: UpdateWorldMember,
  ): Promise<WorldMemberRecord | null> {
    return this.worldMemberRepository.update(id, input);
  }
}
