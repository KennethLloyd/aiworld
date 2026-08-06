import {
  AdminCharacterResponse,
  AdminListCharactersResponse,
  CharacterResponse,
  ListCharactersResponse,
} from '@aiworld/shared/schemas/character-response.schema';
import { Paginated } from '@aiworld/shared/schemas/pagination.schema';
import { Injectable } from '@nestjs/common';

import { CharacterRecord } from '@/characters/domain/character-record';

@Injectable()
export class CharacterResponseMapper {
  mapToCharacterResponse(record: CharacterRecord): CharacterResponse {
    const { systemPrompt: _systemPrompt, ...publicRecord } = record;
    return {
      ...publicRecord,
      avatarUrl: record.avatarUrl,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }

  mapToAdminCharacterResponse(record: CharacterRecord): AdminCharacterResponse {
    return {
      ...this.mapToCharacterResponse(record),
      systemPrompt: record.systemPrompt,
    };
  }

  mapToPaginatedCharacterResponse(
    records: Paginated<CharacterRecord>,
  ): ListCharactersResponse {
    return {
      ...records,
      items: records.items.map((item) => this.mapToCharacterResponse(item)),
    };
  }

  mapToAdminPaginatedCharacterResponse(
    records: Paginated<CharacterRecord>,
  ): AdminListCharactersResponse {
    return {
      ...records,
      items: records.items.map((item) =>
        this.mapToAdminCharacterResponse(item),
      ),
    };
  }
}
