import { Injectable } from '@nestjs/common';

import { SimulationActionType } from '@/simulation/actions/simulation-action-type';
import { ActionWeights } from '@/simulation/lifecycle/domain/world-simulation-config-record';
import { SimulationCastingRepository } from '@/simulation/scheduler/simulation-casting-repository.interface';
import { SimulationRandomSource } from '@/simulation/scheduler/simulation-random-source';
import { SimulationIterationPickError } from '@/simulation/scheduler/simulation-scheduler.error';

const RECENT_POSTS_LIMIT = 20;

export type PickedActor = {
  characterId: string;
  memberId: string;
};

/** Composes the random decisions behind an iteration: which character acts,
 * which weighted action they take, and (for VOTE/COMMENT) which post they
 * target. Character selection is activity-balanced — the least-recently-active
 * resident is picked first, ties broken at random — so no resident is left
 * silent while others act repeatedly. All randomness flows through an injected
 * source, so the weighting is deterministic under test. */
@Injectable()
export class SimulationIterationPicker {
  constructor(
    private readonly castingRepository: SimulationCastingRepository,
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

  async pickCharacter(
    worldId: string,
    random: () => number = () => this.randomSource.next(),
  ): Promise<PickedActor> {
    const candidates = await this.castingRepository.findActiveActors(worldId);
    if (candidates.length === 0) {
      throw new SimulationIterationPickError(
        'NO_ACTIVE_RESIDENTS',
        `World "${worldId}" has no active AI residents to act`,
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
      memberId: picked.memberId,
    };
  }

  async pickTargetPost(
    worldId: string,
    random: () => number = () => this.randomSource.next(),
  ): Promise<string | null> {
    const postIds = await this.castingRepository.findRecentPostIds(
      worldId,
      RECENT_POSTS_LIMIT,
    );
    if (postIds.length === 0) {
      return null;
    }
    return postIds[Math.floor(random() * postIds.length)];
  }
}
