import { Injectable } from '@nestjs/common';

import { PrismaService } from '@/lib/database/prisma.service';
import {
  ActiveActorCandidate,
  SimulationCastingRepository,
} from '@/simulation/scheduler/simulation-casting-repository.interface';

@Injectable()
export class PrismaSimulationCastingRepository extends SimulationCastingRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findActiveActors(worldId: string): Promise<ActiveActorCandidate[]> {
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

    return members.flatMap((member) => {
      if (member.characterId === null) {
        return [];
      }
      return [
        {
          memberId: member.id,
          characterId: member.characterId,
          lastActivityAt: activity.get(member.id) ?? null,
        },
      ];
    });
  }

  async findRecentPostIds(worldId: string, limit: number): Promise<string[]> {
    const rows = await this.prisma.post.findMany({
      where: { worldId },
      select: { id: true },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit,
    });
    return rows.map((row) => row.id);
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

  /** Most recent action timestamp per member across posts, comments, and
   * votes (on posts or comments) — the "least recently active" signal for
   * activity-balanced character selection. */
  private async lastActivityByMember(
    worldId: string,
    memberIds: string[],
  ): Promise<Map<string, Date>> {
    const byMember = (
      rows: Array<{ authorMemberId: string; createdAt: Date }>,
    ) => new Map(rows.map((row) => [row.authorMemberId, row.createdAt]));

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
    for (const map of [postRows, commentRows, voteRows].map(byMember)) {
      for (const [memberId, createdAt] of map) {
        const current = latest.get(memberId);
        if (current === undefined || createdAt > current) {
          latest.set(memberId, createdAt);
        }
      }
    }
    return latest;
  }
}
