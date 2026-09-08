import { BadRequestException, Injectable } from '@nestjs/common';

import { CharacterActivityPage } from '@/activity/domain/activity';
import {
  encodeActivityCursor,
  parseActivityCursor,
} from '@/activity/domain/activity-cursor';
import { mergeActivityItems } from '@/activity/domain/activity-timeline';
import { CharactersService } from '@/characters/characters.service';
import { CommentsService } from '@/comments/comments.service';
import { PostsService } from '@/posts/posts.service';
import { WorldMembersService } from '@/world-members/world-members.service';
import { WorldService } from '@/world/world.service';

@Injectable()
export class ActivityService {
  constructor(
    private readonly worldService: WorldService,
    private readonly charactersService: CharactersService,
    private readonly worldMembersService: WorldMembersService,
    private readonly postsService: PostsService,
    private readonly commentsService: CommentsService,
  ) {}

  async findActivity(
    characterId: string,
    worldSlug: string,
    cursor: string | undefined,
    limit: number,
  ): Promise<CharacterActivityPage | null> {
    const world = await this.worldService.getBySlug(worldSlug, false);
    if (!world) {
      return null;
    }

    // No active filter here: an inactive character's public content stays
    // visible (CharactersService.getById would filter it out).
    const character = await this.charactersService.getById(characterId, true);
    if (!character) {
      return null;
    }

    // The membership lookup is World-scoped, so another World's content
    // never surfaces. Inactive memberships still resolve; only a missing
    // membership returns empty.
    const membership = await this.worldMembersService.findByWorldAndCharacter(
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
      this.postsService.findByAuthorMembership(
        world.id,
        membership.id,
        parsedCursor.cursor,
        limit + 1,
      ),
      this.commentsService.findByAuthorMembership(
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
