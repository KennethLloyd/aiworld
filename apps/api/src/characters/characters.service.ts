import {
  CreateCharacter,
  ListCharactersQuery,
  UpdateCharacter,
} from '@aiworld/shared/schemas/character.schema';
import { Paginated } from '@aiworld/shared/schemas/pagination.schema';
import { BadRequestException, Injectable } from '@nestjs/common';

import { CharacterRecord } from '@/characters/domain/character-record';
import { validateMbtiClassification } from '@/characters/domain/classification';
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

  async create(input: CreateCharacter): Promise<CharacterRecord> {
    this.validateWorldClassification(
      input.worldSlug,
      input.classification,
      input.classificationGroup,
    );
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

    const worldSlugs = await this.characterRepository.findWorldSlugs(id);
    const classification =
      input.classification === undefined
        ? existing.classification
        : input.classification;
    const classificationGroup =
      input.classificationGroup === undefined
        ? existing.classificationGroup
        : input.classificationGroup;

    if (worldSlugs.includes('mbti-house')) {
      this.validateWorldClassification(
        'mbti-house',
        classification,
        classificationGroup,
      );
    }

    return this.characterRepository.update(id, input);
  }

  private validateWorldClassification(
    worldSlug: string | undefined,
    classification: string | null | undefined,
    classificationGroup: string | null | undefined,
  ): void {
    if (!worldSlug || worldSlug !== 'mbti-house') {
      return;
    }

    try {
      validateMbtiClassification(classification, classificationGroup);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Invalid MBTI classification',
      );
    }
  }
}
