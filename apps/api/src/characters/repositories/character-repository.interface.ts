import {
  CreateCharacter,
  ListCharactersQuery,
  UpdateCharacter,
} from '@aiworld/shared/schemas/character.schema';
import { Paginated } from '@aiworld/shared/schemas/pagination.schema';

import { CharacterRecord } from '@/characters/domain/character-record';

export abstract class CharacterRepository {
  abstract findAll(
    query: ListCharactersQuery,
  ): Promise<Paginated<CharacterRecord>>;
  abstract findById(
    id: string,
    isActive?: boolean,
  ): Promise<CharacterRecord | null>;
  abstract findWorldSlugs(id: string): Promise<string[]>;
  abstract create(input: CreateCharacter): Promise<CharacterRecord>;
  abstract update(
    id: string,
    input: UpdateCharacter,
  ): Promise<CharacterRecord | null>;
}
