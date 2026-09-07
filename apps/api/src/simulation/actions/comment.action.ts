import { Injectable } from '@nestjs/common';

import { CommentActionContext } from '@/simulation/actions/action-context';
import { composeActionPrompt } from '@/simulation/actions/action-prompt';
import {
  characterSection,
  targetPostSection,
  threadSection,
  worldSection,
} from '@/simulation/actions/prompt-sections';
import { toActionFailure } from '@/simulation/actions/simulation-action.error';
import { SimulationContextProvider } from '@/simulation/actions/simulation-context-provider';
import {
  CommentDecision,
  SimulationActionResult,
} from '@/simulation/actions/simulation-decision';
import { assertSafeSimulationOutput } from '@/simulation/actions/simulation-output-safety';
import { commentOutputSchema } from '@/simulation/actions/simulation-output.schema';
import { LlmProvider } from '@/simulation/providers/llm-provider.port';
export const COMMENT_ACTION_INSTRUCTIONS =
  'Reply to what was actually said in the target post or bounded thread. Choose the response that fits this moment: answer seriously, make a joke, disagree, ask a question, tease, defend someone, add a concrete detail, derail slightly, misunderstand, refuse to engage, escalate, or de-escalate. A comment may be two words or several sentences; do not force a complete argument or a useful new insight. Use parentCommentId only when replying to a supplied comment ID. Do not write an essay, therapy-speak, personality exposition, generic agreement, artificial conflict resolution, or a response that ignores the thread.';

@Injectable()
export class CommentAction {
  constructor(
    private readonly contextProvider: SimulationContextProvider,
    private readonly provider: LlmProvider,
  ) {}

  async execute(input: {
    worldSlug: string;
    characterId: string;
    postId: string;
    parentCommentId?: string;
  }): Promise<SimulationActionResult<CommentDecision>> {
    try {
      const actor = await this.contextProvider.resolveActor(
        input.worldSlug,
        input.characterId,
      );
      const post = await this.contextProvider.findPost(
        actor.world.id,
        input.postId,
      );
      const context: CommentActionContext = {
        ...actor,
        post,
        thread: await this.contextProvider.findThread(post.id),
      };
      const prompt = composeActionPrompt({
        action: 'COMMENT',
        instructions: COMMENT_ACTION_INSTRUCTIONS,
        outputFormat:
          '{"content": string, "parentCommentId": string | null, "reasoning": string}',
        contextSections: [
          worldSection(context.world),
          characterSection(context.character),
          targetPostSection(context.post),
          threadSection(context.thread, input.parentCommentId),
        ],
      });
      const { output, telemetry } = await this.provider.generateStructured({
        prompt,
        schema: commentOutputSchema,
      });
      assertSafeSimulationOutput('COMMENT', output);
      return {
        status: 'success',
        decision: {
          action: 'COMMENT',
          worldId: context.world.id,
          memberId: context.memberId,
          characterId: context.character.id,
          postId: context.post.id,
          content: output.content,
          parentCommentId:
            output.parentCommentId ?? input.parentCommentId ?? null,
          reasoning: output.reasoning,
        },
        telemetry,
      };
    } catch (error) {
      return { status: 'failed', failure: toActionFailure(error) };
    }
  }
}
