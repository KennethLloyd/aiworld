import { Injectable } from '@nestjs/common';

import { PrismaService } from '@/lib/database/prisma.service';
import { SimulationActionType } from '@/simulation/actions/simulation-action-type';
import { ActionWeights } from '@/simulation/lifecycle/domain/simulation-config';
import { SimulationRandomSource } from '@/simulation/scheduler/simulation-random-source';
import { SimulationIterationPickError } from '@/simulation/scheduler/simulation-scheduler.error';

const RECENT_POSTS_LIMIT = 20;

export type PickedActor = {
  characterId: string;
};
type ActiveActor = {
  memberId: string;
  characterId: string;
  lastActivityAt: Date | null;
};

/** Composes the random decisions behind an iteration: which character acts,
 * which weighted action they take, and (for VOTE/COMMENT) which post they
 * target. Character selection is activity-balanced — the least-recently-active
 * character is picked first, ties broken at random — so no character is left
 * silent while others act repeatedly. All randomness flows through an injected
 * source, so the weighting is deterministic under test. */
@Injectable()
export class SimulationIterationPicker {
  constructor(
    private readonly prisma: PrismaService,
    private readonly randomSource: SimulationRandomSource,
  ) {}

  pickAction(
    actionWeights: ActionWeights,
    random: () => number = () => this.randomSource.next(),
  ): SimulationActionType {
    const total =
      actionWeights.POST + actionWeights.VOTE + actionWeights.COMMENT;
    const roll = random() * total;

    const candidates: ReadonlyArray<[SimulationActionType, number]> = [
      ['POST', actionWeights.POST],
      ['VOTE', actionWeights.VOTE],
      ['COMMENT', actionWeights.COMMENT],
    ];

    let cumulative = 0;
    for (const [action, weight] of candidates) {
      cumulative += weight;
      if (roll < cumulative) {
        return action;
      }
    }
    return 'COMMENT';
  }

  async pickAutomaticAction(
    worldId: string,
    actionWeights: ActionWeights,
    random: () => number = () => this.randomSource.next(),
  ): Promise<SimulationActionType> {
    const postIds = await this.findRecentPostIds(worldId, 1);
    if (postIds.length === 0) {
      return 'POST';
    }
    return this.pickAction(actionWeights, random);
  }

  async pickCharacter(
    worldId: string,
    random: () => number = () => this.randomSource.next(),
  ): Promise<PickedActor> {
    const candidates = await this.findActiveActors(worldId);
    if (candidates.length === 0) {
      throw new SimulationIterationPickError(
        'NO_ACTIVE_CHARACTERS',
        `World "${worldId}" has no active AI characters to act`,
      );
    }

    const asMillis = (date: Date | null): number => date?.getTime() ?? 0;
    const leastRecent = Math.min(
      ...candidates.map((candidate) => asMillis(candidate.lastActivityAt)),
    );
    const tied = candidates.filter(
      (candidate) => asMillis(candidate.lastActivityAt) <= leastRecent,
    );
    const picked = tied[Math.floor(random() * tied.length)];

    return {
      characterId: picked.characterId,
    };
  }

  async pickTargetPost(
    worldId: string,
    random: () => number = () => this.randomSource.next(),
  ): Promise<string | null> {
    const postIds = await this.findRecentPostIds(worldId, RECENT_POSTS_LIMIT);
    if (postIds.length === 0) {
      return null;
    }
    return postIds[Math.floor(random() * postIds.length)];
  }

  async findActiveActor(
    worldId: string,
    characterId: string,
  ): Promise<boolean> {
    const member = await this.prisma.worldMember.findFirst({
      where: {
        worldId,
        characterId,
        role: 'AI',
        isActive: true,
        character: { isActive: true },
      },
      select: { id: true },
    });
    return member !== null;
  }

  async hasActiveActors(worldId: string): Promise<boolean> {
    const actors = await this.findActiveActors(worldId);
    return actors.length > 0;
  }

  private async findRecentPostIds(
    worldId: string,
    limit: number,
  ): Promise<string[]> {
    const rows = await this.prisma.post.findMany({
      where: { worldId },
      select: { id: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit,
    });
    return rows.map((row) => row.id);
  }

  private async findActiveActors(worldId: string): Promise<ActiveActor[]> {
    const members = await this.prisma.worldMember.findMany({
      where: {
        worldId,
        role: 'AI',
        isActive: true,
        characterId: { not: null },
        character: { isActive: true },
      },
      select: { id: true, characterId: true },
    });
    const memberIds = members.flatMap((member) =>
      member.characterId === null ? [] : [member.id],
    );
    if (memberIds.length === 0) {
      return [];
    }

    const activity = await this.lastActivityByMember(worldId, memberIds);
    return members.flatMap((member) =>
      member.characterId === null
        ? []
        : [
            {
              memberId: member.id,
              characterId: member.characterId,
              lastActivityAt: activity.get(member.id) ?? null,
            },
          ],
    );
  }

  private async lastActivityByMember(
    worldId: string,
    memberIds: string[],
  ): Promise<Map<string, Date>> {
    const [postRows, commentRows, voteRows] = await Promise.all([
      this.prisma.post.findMany({
        where: { worldId, authorMemberId: { in: memberIds } },
        select: { authorMemberId: true, createdAt: true },
      }),
      this.prisma.comment.findMany({
        where: { post: { worldId }, authorMemberId: { in: memberIds } },
        select: { authorMemberId: true, createdAt: true },
      }),
      this.prisma.vote.findMany({
        where: {
          authorMemberId: { in: memberIds },
          OR: [{ post: { worldId } }, { comment: { post: { worldId } } }],
        },
        select: { authorMemberId: true, createdAt: true },
      }),
    ]);
    const latest = new Map<string, Date>();
    for (const rows of [postRows, commentRows, voteRows]) {
      for (const row of rows) {
        const current = latest.get(row.authorMemberId);
        if (current === undefined || row.createdAt > current) {
          latest.set(row.authorMemberId, row.createdAt);
        }
      }
    }
    return latest;
  }
}
