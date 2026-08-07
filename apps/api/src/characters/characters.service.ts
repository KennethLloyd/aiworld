import {
  CreateCharacter,
  ListCharactersQuery,
  UpdateCharacter,
} from '@aiworld/shared/schemas/character.schema';
import { Paginated } from '@aiworld/shared/schemas/pagination.schema';
import { Injectable } from '@nestjs/common';

import { CharacterRecord } from '@/characters/domain/character-record';
import { CharacterRepository } from '@/characters/repositories/character-repository.interface';

@Injectable()
export class CharactersService {
  constructor(private readonly characterRepository: CharacterRepository) {}

  list(
    query: ListCharactersQuery,
    isAdmin: boolean,
  ): Promise<Paginated<CharacterRecord>> {
    return this.characterRepository.findAll({
      ...query,
      search: query.search?.trim() || undefined,
      classification: query.classification?.trim() || undefined,
      classificationGroup: query.classificationGroup?.trim() || undefined,
      isActive: isAdmin ? query.isActive : true,
    });
  }

  getById(id: string, isAdmin: boolean): Promise<CharacterRecord | null> {
    return this.characterRepository.findById(id, isAdmin ? undefined : true);
  }

  create(input: CreateCharacter): Promise<CharacterRecord> {
    return this.characterRepository.create(input);
  }

  async update(
    id: string,
    input: UpdateCharacter,
  ): Promise<CharacterRecord | null> {
    const existing = await this.characterRepository.findById(id);
    if (!existing) {
      return null;
    }

    return this.characterRepository.update(id, input);
  }
}
