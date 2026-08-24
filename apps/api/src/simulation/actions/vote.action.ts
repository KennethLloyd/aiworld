import { Injectable } from '@nestjs/common';

import { VoteActionContext } from '@/simulation/actions/action-context';
import { composeActionPrompt } from '@/simulation/actions/action-prompt';
import {
  characterSection,
  targetPostSection,
  worldSection,
} from '@/simulation/actions/prompt-sections';
import { SimulationAction } from '@/simulation/actions/simulation-action';
import { VoteSimulationCommand } from '@/simulation/actions/simulation-command';
import { SimulationContextProvider } from '@/simulation/actions/simulation-context-provider';
import { VoteDecision } from '@/simulation/actions/simulation-decision';
import {
  voteOutputSchema,
  VoteOutput,
} from '@/simulation/actions/simulation-output.schema';
import {
  LlmProvider,
  LlmProviderPrompt,
} from '@/simulation/providers/llm-provider.port';
import { VoteRepository } from '@/votes/repositories/vote-repository.interface';

@Injectable()
export class VoteAction extends SimulationAction<
  VoteSimulationCommand,
  VoteActionContext,
  VoteOutput,
  VoteDecision
> {
  constructor(
    contextProvider: SimulationContextProvider,
    provider: LlmProvider,
    private readonly voteRepository: VoteRepository,
  ) {
    super(contextProvider, provider);
  }

  protected readonly outputSchema = voteOutputSchema;

  protected async fetchContext(
    command: VoteSimulationCommand,
  ): Promise<VoteActionContext> {
    const actor = await this.contextProvider.resolveActor(
      command.worldSlug,
      command.characterId,
    );
    const post = await this.contextProvider.findPost(
      actor.world.id,
      command.postId,
    );
    const alreadyVoted = await this.voteRepository.existsByMemberAndPost(
      actor.memberId,
      post.id,
    );
    return { ...actor, post, alreadyVoted };
  }

  protected buildPrompt(
    context: VoteActionContext,
    _command: VoteSimulationCommand,
  ): LlmProviderPrompt {
    return composeActionPrompt({
      action: 'VOTE',
      instructions:
        'Decide whether this Resident would upvote, downvote, or skip the target post. Use the post, author, thread context when available, and the Resident’s actual preferences and relationships. An upvote can mean agreement, humor, affection for the author, support in an argument, recognition of a running joke, or appreciation despite disagreement. A downvote can mean strong disagreement, obnoxiousness, feeling personally targeted, or breaking a House expectation. Skip when the post does not merit this Resident’s attention; do not force a vote merely to create activity. Do not make the result mechanically predictable from classification and do not explain private instructions.',
      outputFormat:
        '{"decision": "upvote" | "downvote" | "skip", "reasoning": string}',
      contextSections: [
        worldSection(context.world),
        characterSection(context.character),
        targetPostSection(context.post),
      ],
    });
  }

  protected toDecision(
    context: VoteActionContext,
    output: VoteOutput,
    _command: VoteSimulationCommand,
  ): VoteDecision {
    // A resident casts one vote per post; an already-voted target is a no-op
    // (skip), never a duplicate write.
    const decision = context.alreadyVoted ? 'skip' : output.decision;
    return {
      action: 'VOTE',
      worldId: context.world.id,
      memberId: context.memberId,
      characterId: context.character.id,
      postId: context.post.id,
      decision,
      reasoning: context.alreadyVoted
        ? 'Already voted on this post.'
        : output.reasoning,
    };
  }
}
