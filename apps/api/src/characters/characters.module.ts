import { Module } from '@nestjs/common';

import { CharactersController } from '@/characters/characters.controller';
import { CharactersService } from '@/characters/characters.service';
import { CharacterResponseMapper } from '@/characters/mappers/character-response.mapper';
import { CharacterRepository } from '@/characters/repositories/character-repository.interface';
import { PrismaCharacterRepository } from '@/characters/repositories/prisma-character.repository';

@Module({
  controllers: [CharactersController],
  providers: [
    {
      provide: CharacterRepository,
      useClass: PrismaCharacterRepository,
    },
    CharacterResponseMapper,
    CharactersService,
  ],
  exports: [CharacterRepository, CharactersService],
})
export class CharactersModule {}
