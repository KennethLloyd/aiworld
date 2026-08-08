import { BadRequestException, Injectable } from '@nestjs/common';

import {
  encodeActivityCursor,
  parseActivityCursor,
} from '@/activity/domain/activity-cursor';
import { CharacterActivityPageRecord } from '@/activity/domain/activity-record';
import { mergeActivityItems } from '@/activity/domain/activity-timeline';
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
    cursor: string | undefined,
    limit: number,
  ): Promise<CharacterActivityPageRecord | null> {
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
      return { items: [], nextCursor: null };
    }

    const parsedCursor = parseActivityCursor(cursor);
    if (!parsedCursor.ok) {
      throw new BadRequestException({
        statusCode: 400,
        message: [
          { code: 'custom', path: ['cursor'], message: 'Invalid cursor.' },
        ],
        error: 'Validation Failed',
      });
    }

    // Over-fetch one item per stream: with `limit + 1` from each side, the
    // merged page has more than `limit` items exactly when more items
    // remain, so nextCursor is exact.
    const [posts, comments] = await Promise.all([
      this.postRepository.findByAuthorMembership(
        world.id,
        membership.id,
        parsedCursor.cursor,
        limit + 1,
      ),
      this.commentRepository.findByAuthorMembership(
        world.id,
        membership.id,
        parsedCursor.cursor,
        limit + 1,
      ),
    ]);

    const merged = mergeActivityItems(posts, comments);
    const items = merged.slice(0, limit);
    const nextCursor =
      merged.length > limit
        ? encodeActivityCursor(items[items.length - 1])
        : null;

    return { items, nextCursor };
  }
}
