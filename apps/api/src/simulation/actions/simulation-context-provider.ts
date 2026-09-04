import { Injectable } from '@nestjs/common';

import { CharacterRepository } from '@/characters/repositories/character-repository.interface';
import { FlatCommentRecord } from '@/comments/domain/comment-record';
import { CommentRepository } from '@/comments/repositories/comment-repository.interface';
import { PostWithAuthorRecord } from '@/posts/domain/post-record';
import { PostRepository } from '@/posts/repositories/post-repository.interface';
import { ResolvedActor } from '@/simulation/actions/action-context';
import { SimulationActionError } from '@/simulation/actions/simulation-action.error';
import { WorldMemberRepository } from '@/world-members/repositories/world-member-repository.interface';
import { WorldRepository } from '@/world/repositories/world-repository.interface';

const RECENT_POST_LIMIT = 5;

@Injectable()
export class SimulationContextProvider {
  constructor(
    private readonly worldRepository: WorldRepository,
    private readonly characterRepository: CharacterRepository,
    private readonly worldMemberRepository: WorldMemberRepository,
    private readonly postRepository: PostRepository,
    private readonly commentRepository: CommentRepository,
  ) {}

  /** Resolves the actor behind an action: an active World, an active
   * Character, and its active WorldMember membership (ADR-0002). Any
   * inactive or missing link is a hard failure — never selected. */
  async resolveActor(
    worldSlug: string,
    characterId: string,
  ): Promise<ResolvedActor> {
    const world = await this.worldRepository.findBySlug(worldSlug, true);
    if (!world) {
      throw new SimulationActionError(
        'WORLD_NOT_FOUND',
        `World "${worldSlug}" was not found or is inactive`,
      );
    }

    const character = await this.characterRepository.findById(
      characterId,
      true,
    );
    if (!character) {
      throw new SimulationActionError(
        'CHARACTER_INACTIVE',
        `Character "${characterId}" was not found or is inactive`,
      );
    }

    const member =
      await this.worldMemberRepository.findActiveByWorldAndCharacter(
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

  async findPost(
    worldId: string,
    postId: string,
  ): Promise<PostWithAuthorRecord> {
    const post = await this.postRepository.findById(worldId, postId);
    if (!post) {
      throw new SimulationActionError(
        'POST_NOT_FOUND',
        `Post "${postId}" was not found in this World`,
      );
    }
    return post;
  }

  async findRecentPosts(worldId: string): Promise<PostWithAuthorRecord[]> {
    return this.postRepository.findRecentByWorld(worldId, RECENT_POST_LIMIT);
  }

  async findThread(postId: string): Promise<FlatCommentRecord[]> {
    return this.commentRepository.findByPostId(postId);
  }
}
