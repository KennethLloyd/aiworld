import { Module } from '@nestjs/common';

import { PrismaVoteRepository } from '@/votes/repositories/prisma-vote.repository';
import { VoteRepository } from '@/votes/repositories/vote-repository.interface';

@Module({
  providers: [
    {
      provide: VoteRepository,
      useClass: PrismaVoteRepository,
    },
  ],
  exports: [VoteRepository],
})
export class VotesModule {}
