import { Injectable } from '@nestjs/common';

import { PostActionContext } from '@/simulation/actions/action-context';
import { composeActionPrompt } from '@/simulation/actions/action-prompt';
import {
  characterSection,
  recentActivitySection,
  worldSection,
} from '@/simulation/actions/prompt-sections';
import { toActionFailure } from '@/simulation/actions/simulation-action.error';
import { SimulationContextProvider } from '@/simulation/actions/simulation-context-provider';
import {
  PostDecision,
  SimulationActionResult,
} from '@/simulation/actions/simulation-decision';
import { assertSafeSimulationOutput } from '@/simulation/actions/simulation-output-safety';
import { postOutputSchema } from '@/simulation/actions/simulation-output.schema';
import { LlmProvider } from '@/simulation/providers/llm-provider.port';
export const POST_ACTION_INSTRUCTIONS =
  'Start a new conversation only when this actor has a plausible reason to open the forum: an observation, question, discovery, bit of gossip, request for help, celebration, mundane detail, unpopular opinion, callback, or reaction to something in the current World. Use a specific hook grounded in the supplied World context rather than a generic philosophical prompt. Write a title that sounds like a real forum post and content that can be short, incomplete, funny, awkward, or thoughtful as the moment warrants. Do not write a personality demonstration, announce the classification, narrate private thoughts, invent outside-world access, or speak for another actor.';

@Injectable()
export class PostAction {
  constructor(
    private readonly contextProvider: SimulationContextProvider,
    private readonly provider: LlmProvider,
  ) {}

  async execute(input: {
    worldSlug: string;
    characterId: string;
  }): Promise<SimulationActionResult<PostDecision>> {
    try {
      const actor = await this.contextProvider.resolveActor(
        input.worldSlug,
        input.characterId,
      );
      const context: PostActionContext = {
        ...actor,
        recentPosts: await this.contextProvider.findRecentPosts(actor.world.id),
      };
      const recentActivity = recentActivitySection(context.recentPosts);
      const prompt = composeActionPrompt({
        action: 'POST',
        instructions: POST_ACTION_INSTRUCTIONS,
        outputFormat:
          '{"title": string, "content": string, "reasoning": string}',
        contextSections: [
          worldSection(context.world),
          characterSection(context.character),
          ...(recentActivity ? [recentActivity] : []),
        ],
      });
      const { output, telemetry } = await this.provider.generateStructured({
        prompt,
        schema: postOutputSchema,
      });
      assertSafeSimulationOutput('POST', output);
      return {
        status: 'success',
        decision: {
          action: 'POST',
          worldId: context.world.id,
          memberId: context.memberId,
          characterId: context.character.id,
          title: output.title,
          content: output.content,
          reasoning: output.reasoning,
        },
        telemetry,
      };
    } catch (error) {
      return { status: 'failed', failure: toActionFailure(error) };
    }
  }
}
