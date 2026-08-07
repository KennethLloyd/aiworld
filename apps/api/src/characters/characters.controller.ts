import {
  AdminCharacterResponse,
  AdminListCharactersResponse,
  CharacterResponse,
  ListCharactersResponse,
} from '@aiworld/shared/schemas/character-response.schema';
import {
  createCharacterSchema,
  listCharactersQuerySchema,
  updateCharacterSchema,
} from '@aiworld/shared/schemas/character.schema';
import type {
  CreateCharacter,
  ListCharactersQuery,
  UpdateCharacter,
} from '@aiworld/shared/schemas/character.schema';
import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { AllowAnonymous, Roles } from '@thallesp/nestjs-better-auth';

import { CharactersService } from '@/characters/characters.service';
import { CharacterResponseMapper } from '@/characters/mappers/character-response.mapper';
import { ZodValidationPipe } from '@/common/pipes';
import { isAdminRequest } from '@/lib/auth/request-access';
import type { AuthenticatedRequest } from '@/lib/auth/request-access';

@Controller('characters')
export class CharactersController {
  constructor(
    private readonly charactersService: CharactersService,
    private readonly characterResponseMapper: CharacterResponseMapper,
  ) {}

  @Get()
  @AllowAnonymous()
  async list(
    @Query(new ZodValidationPipe(listCharactersQuerySchema))
    query: ListCharactersQuery,
    @Req() request: AuthenticatedRequest,
  ): Promise<ListCharactersResponse | AdminListCharactersResponse> {
    const admin = isAdminRequest(request);
    const characters = await this.charactersService.list(query, admin);

    return admin
      ? this.characterResponseMapper.mapToAdminPaginatedCharacterResponse(
          characters,
        )
      : this.characterResponseMapper.mapToPaginatedCharacterResponse(
          characters,
        );
  }

  @Get(':characterId')
  @AllowAnonymous()
  async getById(
    @Param('characterId') characterId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<CharacterResponse | AdminCharacterResponse> {
    const admin = isAdminRequest(request);
    const character = await this.charactersService.getById(characterId, admin);
    if (!character) {
      throw new NotFoundException();
    }

    return admin
      ? this.characterResponseMapper.mapToAdminCharacterResponse(character)
      : this.characterResponseMapper.mapToCharacterResponse(character);
  }

  @Post()
  @Roles(['ADMIN'])
  async create(
    @Body(new ZodValidationPipe(createCharacterSchema)) input: CreateCharacter,
  ): Promise<AdminCharacterResponse> {
    const character = await this.charactersService.create(input);
    return this.characterResponseMapper.mapToAdminCharacterResponse(character);
  }

  @Patch(':characterId')
  @Roles(['ADMIN'])
  async update(
    @Param('characterId') characterId: string,
    @Body(new ZodValidationPipe(updateCharacterSchema)) input: UpdateCharacter,
  ): Promise<AdminCharacterResponse> {
    const character = await this.charactersService.update(characterId, input);
    if (!character) {
      throw new NotFoundException();
    }

    return this.characterResponseMapper.mapToAdminCharacterResponse(character);
  }
}
