import { Module } from '@nestjs/common';

import { CharactersController } from '@/characters/characters.controller';
import { CharactersService } from '@/characters/characters.service';

@Module({
  controllers: [CharactersController],
  providers: [CharactersService],
  exports: [CharactersService],
})
export class CharactersModule {}
