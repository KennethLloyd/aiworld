import { ActionFailure } from '@/simulation/actions/simulation-action.error';
import { VoteDecisionValue } from '@/simulation/actions/simulation-output.schema';
import { LlmProviderTelemetry } from '@/simulation/providers/llm-provider.port';

/** The actionable output of an action: everything a later persistence step
 * needs, with no provider or persistence concerns attached. */
export type PostDecision = {
  action: 'POST';
  worldId: string;
  memberId: string;
  characterId: string;
  title: string;
  content: string;
  reasoning: string;
};

export type VoteDecision = {
  action: 'VOTE';
  worldId: string;
  memberId: string;
  characterId: string;
  postId: string;
  decision: VoteDecisionValue;
  reasoning: string;
};

export type CommentDecision = {
  action: 'COMMENT';
  worldId: string;
  memberId: string;
  characterId: string;
  postId: string;
  content: string;
  parentCommentId: string | null;
  reasoning: string;
};

export type SimulationDecision = PostDecision | VoteDecision | CommentDecision;

export type SimulationActionResult<TDecision extends SimulationDecision> =
  | {
      status: 'success';
      decision: TDecision;
      telemetry: LlmProviderTelemetry;
    }
  | { status: 'failed'; failure: ActionFailure };

export type SimulationActionOutcome =
  SimulationActionResult<SimulationDecision>;
