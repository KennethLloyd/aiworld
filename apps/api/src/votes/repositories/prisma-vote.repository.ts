import { Injectable } from '@nestjs/common';

import { Prisma } from '@/generated/prisma/client';
import { PrismaService } from '@/lib/database/prisma.service';
import {
  CurrentVote,
  VoteRepository,
  VoteValue,
} from '@/votes/repositories/vote-repository.interface';
type VoteTarget =
  | { postId: string; commentId?: never }
  | { commentId: string; postId?: never };

@Injectable()
export class PrismaVoteRepository extends VoteRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findByMemberAndPost(
    memberId: string,
    postId: string,
  ): Promise<CurrentVote | null> {
    return this.findByMemberAndTarget(memberId, { postId });
  }

  async findByMemberAndComment(
    memberId: string,
    commentId: string,
  ): Promise<CurrentVote | null> {
    return this.findByMemberAndTarget(memberId, { commentId });
  }

  async setForPost(input: {
    postId: string;
    authorMemberId: string;
    value: VoteValue | null;
  }): Promise<{ id: string } | null> {
    return this.setForTarget({
      target: { postId: input.postId },
      authorMemberId: input.authorMemberId,
      value: input.value,
    });
  }

  async setForComment(input: {
    commentId: string;
    authorMemberId: string;
    value: VoteValue | null;
  }): Promise<{ id: string } | null> {
    return this.setForTarget({
      target: { commentId: input.commentId },
      authorMemberId: input.authorMemberId,
      value: input.value,
    });
  }

  private async findByMemberAndTarget(
    memberId: string,
    target: VoteTarget,
  ): Promise<CurrentVote | null> {
    const vote = await this.prisma.vote.findFirst({
      where: { authorMemberId: memberId, ...target },
      select: { id: true, value: true },
    });
    return vote ? { id: vote.id, value: vote.value as VoteValue } : null;
  }

  private async setForTarget(input: {
    target: VoteTarget;
    authorMemberId: string;
    value: VoteValue | null;
  }): Promise<{ id: string } | null> {
    return this.prisma.$transaction(
      async (transaction) => {
        const existing = await transaction.vote.findFirst({
          where: { authorMemberId: input.authorMemberId, ...input.target },
          select: { id: true, value: true },
        });

        // Null is explicit removal (for example, a human toggle), not simulation skip.
        // Remove the score contribution only when the vote counted.
        if (input.value === null) {
          if (!existing) {
            return null;
          }

          await transaction.vote.delete({ where: { id: existing.id } });
          if (await this.isActiveMember(transaction, input.authorMemberId)) {
            await this.updateScore(transaction, input.target, -existing.value);
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
                ...input.target,
                authorMemberId: input.authorMemberId,
                value: input.value,
              },
            });
        const scoreDelta = memberIsActive
          ? input.value - (existing?.value ?? 0)
          : 0;
        if (scoreDelta !== 0) {
          await this.updateScore(transaction, input.target, scoreDelta);
        }

        return { id: vote.id };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  private async updateScore(
    transaction: Prisma.TransactionClient,
    target: VoteTarget,
    scoreDelta: number,
  ): Promise<void> {
    if ('postId' in target) {
      await transaction.post.update({
        where: { id: target.postId },
        data: { voteScore: { increment: scoreDelta } },
      });
      return;
    }

    await transaction.comment.update({
      where: { id: target.commentId },
      data: { voteScore: { increment: scoreDelta } },
    });
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
