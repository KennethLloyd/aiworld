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
    return { ...actor, post };
  }

  protected buildPrompt(
    context: VoteActionContext,
    _command: VoteSimulationCommand,
  ): LlmProviderPrompt {
    return composeActionPrompt({
      action: 'VOTE',
      instructions:
        'Decide how this character votes on the target post, then cast that VOTE.',
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
    return {
      action: 'VOTE',
      worldId: context.world.id,
      memberId: context.memberId,
      characterId: context.character.id,
      postId: context.post.id,
      decision: output.decision,
      reasoning: output.reasoning,
    };
  }
}
