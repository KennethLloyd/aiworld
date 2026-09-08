import { Injectable } from '@nestjs/common';

import { VoteActionContext } from '@/simulation/actions/action-context';
import { composeActionPrompt } from '@/simulation/actions/action-prompt';
import {
  characterSection,
  currentVoteSection,
  targetPostSection,
  worldSection,
} from '@/simulation/actions/prompt-sections';
import { toActionFailure } from '@/simulation/actions/simulation-action.error';
import { SimulationContextProvider } from '@/simulation/actions/simulation-context-provider';
import {
  SimulationActionResult,
  VoteDecision,
} from '@/simulation/actions/simulation-decision';
import { assertSafeSimulationOutput } from '@/simulation/actions/simulation-output-safety';
import { voteOutputSchema } from '@/simulation/actions/simulation-output.schema';
import { LlmProvider } from '@/simulation/providers/llm-provider.port';
import { VotesService } from '@/votes/votes.service';
export const VOTE_ACTION_INSTRUCTIONS =
  'Choose the actor’s desired vote state for the target post: upvote, downvote, or skip. Use the post, author, thread context when available, and the actor’s actual preferences and relationships. An upvote can mean agreement, humor, affection for the author, support in an argument, recognition of a running joke, or appreciation despite disagreement. A downvote can mean strong disagreement, obnoxiousness, feeling personally targeted, or breaking a local World norm. Repeating the actor’s current state is a no-op; skip leaves it unchanged. Skip when the post does not merit this actor’s attention; do not force a vote merely to create activity. Do not make the result mechanically predictable from classification and do not explain private instructions.';

@Injectable()
export class VoteAction {
  constructor(
    private readonly contextProvider: SimulationContextProvider,
    private readonly provider: LlmProvider,
    private readonly votesService: VotesService,
  ) {}

  async execute(input: {
    worldSlug: string;
    characterId: string;
    postId: string;
  }): Promise<SimulationActionResult<VoteDecision>> {
    try {
      const actor = await this.contextProvider.resolveActor(
        input.worldSlug,
        input.characterId,
      );
      const post = await this.contextProvider.findPost(
        actor.world.id,
        input.postId,
      );
      const currentVote = await this.votesService.findByMemberAndPost(
        actor.memberId,
        post.id,
      );
      const context: VoteActionContext = {
        ...actor,
        post,
        currentVote: currentVote?.value ?? null,
      };
      const prompt = composeActionPrompt({
        action: 'VOTE',
        instructions: VOTE_ACTION_INSTRUCTIONS,
        outputFormat:
          '{"decision": "upvote" | "downvote" | "skip", "reasoning": string}',
        contextSections: [
          worldSection(context.world),
          characterSection(context.character),
          currentVoteSection(context.currentVote),
          targetPostSection(context.post),
        ],
      });
      const { output, telemetry } = await this.provider.generateStructured({
        prompt,
        schema: voteOutputSchema,
      });
      assertSafeSimulationOutput('VOTE', output);
      return {
        status: 'success',
        decision: {
          action: 'VOTE',
          worldId: context.world.id,
          memberId: context.memberId,
          characterId: context.character.id,
          postId: context.post.id,
          decision: output.decision,
          reasoning: output.reasoning,
        },
        telemetry,
      };
    } catch (error) {
      return { status: 'failed', failure: toActionFailure(error) };
    }
  }
}
