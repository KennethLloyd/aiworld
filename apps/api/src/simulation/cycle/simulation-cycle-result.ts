import { ActionFailure } from '@/simulation/actions/simulation-action.error';
import { SimulationExecutionSource } from '@/simulation/domain/simulation-log';
import { SimulationLogRecord } from '@/simulation/logging/simulation-log-record';

export type SimulationCycleStepResult =
  | {
      step: 'POST';
      status: 'success';
      targetId: string;
      log: SimulationLogRecord;
    }
  | {
      step: 'VOTE';
      status: 'success' | 'skipped';
      targetId: string | null;
      log: SimulationLogRecord;
    }
  | {
      step: 'COMMENT';
      status: 'success';
      targetId: string;
      log: SimulationLogRecord;
    }
  | {
      step: 'POST' | 'VOTE' | 'COMMENT';
      status: 'failed';
      failure: ActionFailure;
      log: SimulationLogRecord;
    };

/** The observable outcome of a full mock cycle: one POST, one VOTE, and one
 * COMMENT on the created post, each with its own SimulationLog row. */
export type SimulationCycleResult = {
  status: 'success' | 'failed';
  worldSlug: string;
  characterId: string;
  executionSource: SimulationExecutionSource;
  failure: ActionFailure | null;
  steps: SimulationCycleStepResult[];
};
