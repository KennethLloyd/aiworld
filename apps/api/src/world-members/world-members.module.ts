import { Module } from '@nestjs/common';

import { CharactersModule } from '@/characters/characters.module';
import { WorldMemberResponseMapper } from '@/world-members/mappers/world-member-response.mapper';
import { PrismaWorldMemberRepository } from '@/world-members/repositories/prisma-world-member.repository';
import { WorldMemberRepository } from '@/world-members/repositories/world-member-repository.interface';
import { WorldMembersController } from '@/world-members/world-members.controller';
import { WorldMembersService } from '@/world-members/world-members.service';

@Module({
  imports: [CharactersModule],
  controllers: [WorldMembersController],
  providers: [
    {
      provide: WorldMemberRepository,
      useClass: PrismaWorldMemberRepository,
    },
    WorldMemberResponseMapper,
    WorldMembersService,
  ],
  exports: [WorldMemberRepository, WorldMembersService],
})
export class WorldMembersModule {}
