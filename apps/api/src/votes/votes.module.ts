import { Module } from '@nestjs/common';

import { VotesService } from '@/votes/votes.service';

@Module({
  providers: [VotesService],
  exports: [VotesService],
})
export class VotesModule {}
