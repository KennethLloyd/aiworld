import { Injectable } from '@nestjs/common';

import { MAX_COMMENT_DEPTH } from '@/comments/domain/comment-tree';
import { CommentLinkRecord } from '@/comments/repositories/comment-repository.interface';
import { CommentRepository } from '@/comments/repositories/comment-repository.interface';
import { PostRepository } from '@/posts/repositories/post-repository.interface';
import { SimulationWriteError } from '@/simulation/actions/simulation-action.error';
import {
  SimulationDecision,
  CommentDecision,
  PostDecision,
  VoteDecision,
} from '@/simulation/actions/simulation-decision';
import { VoteRepository } from '@/votes/repositories/vote-repository.interface';

/** Persists validated decisions through repository ports. */
@Injectable()
export class SimulationContentWriter {
  constructor(
    private readonly postRepository: PostRepository,
    private readonly commentRepository: CommentRepository,
    private readonly voteRepository: VoteRepository,
  ) {}

  /** Returns the created row id, or null for a vote decision that skipped. */
  async persist(decision: SimulationDecision): Promise<{ id: string } | null> {
    switch (decision.action) {
      case 'POST':
        return this.persistPost(decision);
      case 'VOTE':
        return this.persistVote(decision);
      case 'COMMENT':
        return this.persistComment(decision);
    }
  }

  async persistPost(decision: PostDecision): Promise<{ id: string }> {
    return this.postRepository.create({
      worldId: decision.worldId,
      authorMemberId: decision.memberId,
      title: decision.title,
      content: decision.content,
    });
  }

  async persistVote(decision: VoteDecision): Promise<{ id: string } | null> {
    if (decision.decision === 'skip') {
      return null;
    }
    return this.voteRepository.setForPost({
      postId: decision.postId,
      authorMemberId: decision.memberId,
      value: decision.decision === 'upvote' ? 1 : -1,
    });
  }

  /** Enforces parent and depth checks before persisting a comment. */
  async persistComment(decision: CommentDecision): Promise<{ id: string }> {
    await this.assertAllowedParent(decision.postId, decision.parentCommentId);
    return this.commentRepository.create({
      postId: decision.postId,
      authorMemberId: decision.memberId,
      parentCommentId: decision.parentCommentId,
      content: decision.content,
    });
  }

  private async assertAllowedParent(
    postId: string,
    parentCommentId: string | null,
  ): Promise<void> {
    if (parentCommentId === null) {
      return;
    }

    const parent = await this.commentRepository.findById(parentCommentId);
    if (!parent) {
      throw new SimulationWriteError(
        'COMMENT_PARENT_NOT_FOUND',
        `Parent comment "${parentCommentId}" was not found`,
      );
    }
    if (parent.postId !== postId) {
      throw new SimulationWriteError(
        'COMMENT_PARENT_POST_MISMATCH',
        `Parent comment "${parentCommentId}" is not on the target post`,
      );
    }

    const depth = await this.depthOf(parent);
    if (depth >= MAX_COMMENT_DEPTH) {
      throw new SimulationWriteError(
        'COMMENT_DEPTH_EXCEEDED',
        `Comments cannot be nested deeper than ${MAX_COMMENT_DEPTH} levels`,
      );
    }
  }

  /** Returns the comment depth; writes cap it at three levels. */
  private async depthOf(comment: CommentLinkRecord): Promise<number> {
    let depth = 1;
    let parentCommentId = comment.parentCommentId;
    while (parentCommentId) {
      const parent = await this.commentRepository.findById(parentCommentId);
      if (!parent) {
        break;
      }
      depth += 1;
      parentCommentId = parent.parentCommentId;
    }
    return depth;
  }
}
