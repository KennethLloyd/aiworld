import { Injectable } from '@nestjs/common';

import { PostActionContext } from '@/simulation/actions/action-context';
import { composeActionPrompt } from '@/simulation/actions/action-prompt';
import {
  characterSection,
  worldSection,
} from '@/simulation/actions/prompt-sections';
import { SimulationAction } from '@/simulation/actions/simulation-action';
import { PostSimulationCommand } from '@/simulation/actions/simulation-command';
import { SimulationContextProvider } from '@/simulation/actions/simulation-context-provider';
import { PostDecision } from '@/simulation/actions/simulation-decision';
import {
  postOutputSchema,
  PostOutput,
} from '@/simulation/actions/simulation-output.schema';
import {
  LlmProvider,
  LlmProviderPrompt,
} from '@/simulation/providers/llm-provider.port';

@Injectable()
export class PostAction extends SimulationAction<
  PostSimulationCommand,
  PostActionContext,
  PostOutput,
  PostDecision
> {
  constructor(
    contextProvider: SimulationContextProvider,
    provider: LlmProvider,
  ) {
    super(contextProvider, provider);
  }

  protected readonly outputSchema = postOutputSchema;

  protected async fetchContext(
    command: PostSimulationCommand,
  ): Promise<PostActionContext> {
    return this.contextProvider.resolveActor(
      command.worldSlug,
      command.characterId,
    );
  }

  protected buildPrompt(
    context: PostActionContext,
    _command: PostSimulationCommand,
  ): LlmProviderPrompt {
    return composeActionPrompt({
      action: 'POST',
      instructions:
        'Start a new conversation only when this Resident has a plausible reason to open the forum: an annoyance, question, discovery, bit of gossip, request for help, celebration, mundane observation, unpopular opinion, callback, or reaction to something in the House. Use a specific shared-house hook rather than a generic philosophical prompt. Write a title that sounds like a real forum post and content that can be short, incomplete, funny, awkward, or thoughtful as the moment warrants. Do not write a personality demonstration, announce the classification, narrate private thoughts, invent outside-world access, or speak for another Resident.',
      outputFormat: '{"title": string, "content": string, "reasoning": string}',
      contextSections: [
        worldSection(context.world),
        characterSection(context.character),
      ],
    });
  }

  protected toDecision(
    context: PostActionContext,
    output: PostOutput,
    _command: PostSimulationCommand,
  ): PostDecision {
    return {
      action: 'POST',
      worldId: context.world.id,
      memberId: context.memberId,
      characterId: context.character.id,
      title: output.title,
      content: output.content,
      reasoning: output.reasoning,
    };
  }
}
