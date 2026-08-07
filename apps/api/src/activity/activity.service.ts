import { Injectable } from '@nestjs/common';

import { CharacterActivityRecord } from '@/activity/domain/activity-record';
import { CharacterRepository } from '@/characters/repositories/character-repository.interface';
import { CommentRepository } from '@/comments/repositories/comment-repository.interface';
import { PostRepository } from '@/posts/repositories/post-repository.interface';
import { WorldMemberRepository } from '@/world-members/repositories/world-member-repository.interface';
import { WorldService } from '@/world/world.service';

@Injectable()
export class ActivityService {
  constructor(
    private readonly worldService: WorldService,
    private readonly characterRepository: CharacterRepository,
    private readonly worldMemberRepository: WorldMemberRepository,
    private readonly postRepository: PostRepository,
    private readonly commentRepository: CommentRepository,
  ) {}

  async findActivity(
    characterId: string,
    worldSlug: string,
  ): Promise<CharacterActivityRecord | null> {
    const world = await this.worldService.getBySlug(worldSlug, false);
    if (!world) {
      return null;
    }

    // No active filter here: an inactive character's public content stays
    // visible (CharactersService.getById would filter it out).
    const character = await this.characterRepository.findById(characterId);
    if (!character) {
      return null;
    }

    // The membership lookup is World-scoped, so another World's content
    // never surfaces. Inactive memberships still resolve; only a missing
    // membership returns empty.
    const membership = await this.worldMemberRepository.findByWorldAndCharacter(
      world.id,
      characterId,
    );
    if (!membership) {
      return { posts: [], comments: [] };
    }

    const [posts, comments] = await Promise.all([
      this.postRepository.findByAuthorMembership(world.id, membership.id),
      this.commentRepository.findByAuthorMembership(world.id, membership.id),
    ]);

    return { posts, comments };
  }
}
