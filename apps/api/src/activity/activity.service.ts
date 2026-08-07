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

    // The active state never blocks the read: an inactive character's public
    // content stays visible, so the character resolves without the active
    // filter (CharactersService.getById would filter it out).
    const character = await this.characterRepository.findById(characterId);
    if (!character) {
      return null;
    }

    // A character with no membership in this World has no activity here. The
    // membership lookup is World-scoped (worldId + characterId), and a
    // missing or inactive membership resolves to an empty, well-defined
    // result instead of leaking another World's content.
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
