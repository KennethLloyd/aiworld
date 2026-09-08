import { Module } from '@nestjs/common';

import { WorldMembersController } from '@/world-members/world-members.controller';
import { WorldMembersService } from '@/world-members/world-members.service';

@Module({
  controllers: [WorldMembersController],
  providers: [WorldMembersService],
  exports: [WorldMembersService],
})
export class WorldMembersModule {}
