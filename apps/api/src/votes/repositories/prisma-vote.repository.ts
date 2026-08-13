import { Injectable } from '@nestjs/common';

import { PrismaService } from '@/lib/database/prisma.service';
import { VoteRepository } from '@/votes/repositories/vote-repository.interface';

@Injectable()
export class PrismaVoteRepository extends VoteRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async create(input: {
    postId: string;
    authorMemberId: string;
    value: 1 | -1;
  }): Promise<{ id: string }> {
    const vote = await this.prisma.vote.create({ data: input });
    return { id: vote.id };
  }

  async existsByMemberAndPost(
    memberId: string,
    postId: string,
  ): Promise<boolean> {
    const vote = await this.prisma.vote.findFirst({
      where: { authorMemberId: memberId, postId },
      select: { id: true },
    });
    return vote !== null;
  }
}
