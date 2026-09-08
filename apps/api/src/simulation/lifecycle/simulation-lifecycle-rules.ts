import { SimulationState } from '@/simulation/lifecycle/domain/simulation-state';
import { InvalidSimulationStateTransitionError } from '@/simulation/lifecycle/simulation-lifecycle.error';

/** HALTED can only be restarted through Run. */
const allowedTransitions: Record<SimulationState, readonly SimulationState[]> =
  {
    RUNNING: ['PAUSED', 'HALTED'],
    PAUSED: ['RUNNING', 'HALTED'],
    HALTED: ['RUNNING'],
  };

/** Scheduled turns run only while RUNNING. */
export function canSchedule(state: SimulationState): boolean {
  return state === 'RUNNING';
}

/** Manual work is allowed in RUNNING and PAUSED. */
export function canRunManualWork(state: SimulationState): boolean {
  return state !== 'HALTED';
}

export function canTransition(
  from: SimulationState,
  to: SimulationState,
): boolean {
  return from === to || allowedTransitions[from].includes(to);
}

export function transitionSimulationState(
  from: SimulationState,
  to: SimulationState,
): SimulationState {
  if (!canTransition(from, to)) {
    throw new InvalidSimulationStateTransitionError(from, to);
  }

  return to;
}
