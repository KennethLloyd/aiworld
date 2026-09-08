import { Injectable } from '@nestjs/common';

import { CharactersService } from '@/characters/characters.service';
import { CommentsService } from '@/comments/comments.service';
import { FlatComment } from '@/comments/domain/comment';
import { PostWithAuthor } from '@/posts/domain/post';
import { PostsService } from '@/posts/posts.service';
import { ResolvedActor } from '@/simulation/actions/action-context';
import { SimulationActionError } from '@/simulation/actions/simulation-action.error';
import { WorldMembersService } from '@/world-members/world-members.service';
import { WorldService } from '@/world/world.service';

const RECENT_POST_LIMIT = 5;

@Injectable()
export class SimulationContextProvider {
  constructor(
    private readonly worldService: WorldService,
    private readonly charactersService: CharactersService,
    private readonly worldMembersService: WorldMembersService,
    private readonly postsService: PostsService,
    private readonly commentsService: CommentsService,
  ) {}

  /** Resolves the actor behind an action: an active World, an active
   * Character, and its active WorldMember membership (ADR-0002). Any
   * inactive or missing link is a hard failure — never selected. */
  async resolveActor(
    worldSlug: string,
    characterId: string,
  ): Promise<ResolvedActor> {
    const world = await this.worldService.getBySlug(worldSlug, false);
    if (!world) {
      throw new SimulationActionError(
        'WORLD_NOT_FOUND',
        `World "${worldSlug}" was not found or is inactive`,
      );
    }

    const character = await this.charactersService.getById(characterId, false);
    if (!character) {
      throw new SimulationActionError(
        'CHARACTER_INACTIVE',
        `Character "${characterId}" was not found or is inactive`,
      );
    }

    const member = await this.worldMembersService.findActiveByWorldAndCharacter(
      world.id,
      characterId,
    );
    if (!member) {
      throw new SimulationActionError(
        'MEMBER_NOT_FOUND',
        `No active membership for character "${characterId}" in this World`,
      );
    }

    return { world, character, memberId: member.id };
  }

  async findPost(worldId: string, postId: string): Promise<PostWithAuthor> {
    const post = await this.postsService.findById(worldId, postId);
    if (!post) {
      throw new SimulationActionError(
        'POST_NOT_FOUND',
        `Post "${postId}" was not found in this World`,
      );
    }
    return post;
  }

  async findRecentPosts(worldId: string): Promise<PostWithAuthor[]> {
    return this.postsService.findRecentByWorld(worldId, RECENT_POST_LIMIT);
  }

  async findThread(postId: string): Promise<FlatComment[]> {
    return this.commentsService.findByPostId(postId);
  }
}
