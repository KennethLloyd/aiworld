import { Injectable } from '@nestjs/common';

import { Prisma } from '@/generated/prisma/client';
import { PrismaService } from '@/lib/database/prisma.service';
import {
  CurrentPostVote,
  VoteRepository,
  VoteValue,
} from '@/votes/repositories/vote-repository.interface';

@Injectable()
export class PrismaVoteRepository extends VoteRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findByMemberAndPost(
    memberId: string,
    postId: string,
  ): Promise<CurrentPostVote | null> {
    const vote = await this.prisma.vote.findFirst({
      where: { authorMemberId: memberId, postId },
      select: { id: true, value: true },
    });
    return vote ? { id: vote.id, value: vote.value as VoteValue } : null;
  }

  async setForPost(input: {
    postId: string;
    authorMemberId: string;
    value: VoteValue | null;
  }): Promise<{ id: string } | null> {
    return this.prisma.$transaction(
      async (transaction) => {
        const existing = await transaction.vote.findFirst({
          where: {
            authorMemberId: input.authorMemberId,
            postId: input.postId,
          },
          select: { id: true, value: true },
        });

        if (input.value === null) {
          if (!existing) {
            return null;
          }

          await transaction.vote.delete({ where: { id: existing.id } });
          if (await this.isActiveMember(transaction, input.authorMemberId)) {
            await transaction.post.update({
              where: { id: input.postId },
              data: { voteScore: { decrement: existing.value } },
            });
          }
          return null;
        }

        if (existing?.value === input.value) {
          return { id: existing.id };
        }

        const memberIsActive = await this.isActiveMember(
          transaction,
          input.authorMemberId,
        );
        const vote = existing
          ? await transaction.vote.update({
              where: { id: existing.id },
              data: { value: input.value },
            })
          : await transaction.vote.create({
              data: {
                postId: input.postId,
                authorMemberId: input.authorMemberId,
                value: input.value,
              },
            });
        const scoreDelta = memberIsActive
          ? input.value - (existing?.value ?? 0)
          : 0;
        if (scoreDelta !== 0) {
          await transaction.post.update({
            where: { id: input.postId },
            data: { voteScore: { increment: scoreDelta } },
          });
        }

        return { id: vote.id };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  private async isActiveMember(
    transaction: Prisma.TransactionClient,
    memberId: string,
  ): Promise<boolean> {
    const member = await transaction.worldMember.findUnique({
      where: { id: memberId },
      select: { isActive: true },
    });
    return member?.isActive ?? false;
  }
}
