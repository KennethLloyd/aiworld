import { Injectable } from '@nestjs/common';

import { CommentActionContext } from '@/simulation/actions/action-context';
import { composeActionPrompt } from '@/simulation/actions/action-prompt';
import {
  characterSection,
  targetPostSection,
  threadSection,
  worldSection,
} from '@/simulation/actions/prompt-sections';
import { SimulationAction } from '@/simulation/actions/simulation-action';
import { CommentSimulationCommand } from '@/simulation/actions/simulation-command';
import { SimulationContextProvider } from '@/simulation/actions/simulation-context-provider';
import { CommentDecision } from '@/simulation/actions/simulation-decision';
import {
  commentOutputSchema,
  CommentOutput,
} from '@/simulation/actions/simulation-output.schema';
import {
  LlmProvider,
  LlmProviderPrompt,
} from '@/simulation/providers/llm-provider.port';

@Injectable()
export class CommentAction extends SimulationAction<
  CommentSimulationCommand,
  CommentActionContext,
  CommentOutput,
  CommentDecision
> {
  constructor(
    contextProvider: SimulationContextProvider,
    provider: LlmProvider,
  ) {
    super(contextProvider, provider);
  }

  protected readonly outputSchema = commentOutputSchema;

  protected async fetchContext(
    command: CommentSimulationCommand,
  ): Promise<CommentActionContext> {
    const actor = await this.contextProvider.resolveActor(
      command.worldSlug,
      command.characterId,
    );
    const post = await this.contextProvider.findPost(
      actor.world.id,
      command.postId,
    );
    const thread = await this.contextProvider.findThread(post.id);
    return { ...actor, post, thread };
  }

  protected buildPrompt(
    context: CommentActionContext,
    command: CommentSimulationCommand,
  ): LlmProviderPrompt {
    return composeActionPrompt({
      action: 'COMMENT',
      instructions:
        "Write a COMMENT on the target post from this character's perspective, using the bounded thread context below.",
      outputFormat:
        '{"content": string, "parentCommentId": string | null, "reasoning": string}',
      contextSections: [
        worldSection(context.world),
        characterSection(context.character),
        targetPostSection(context.post),
        threadSection(context.thread, command.parentCommentId),
      ],
    });
  }

  protected toDecision(
    context: CommentActionContext,
    output: CommentOutput,
    command: CommentSimulationCommand,
  ): CommentDecision {
    return {
      action: 'COMMENT',
      worldId: context.world.id,
      memberId: context.memberId,
      characterId: context.character.id,
      postId: context.post.id,
      content: output.content,
      parentCommentId:
        output.parentCommentId ?? command.parentCommentId ?? null,
      reasoning: output.reasoning,
    };
  }
}
