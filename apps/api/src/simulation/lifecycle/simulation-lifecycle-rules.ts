import { SimulationState } from '@/simulation/lifecycle/domain/simulation-state';
import { InvalidSimulationStateTransitionError } from '@/simulation/lifecycle/simulation-lifecycle.error';

/** HALTED is terminal for the MVP lifecycle: no transition leaves it. */
const allowedTransitions: Record<SimulationState, readonly SimulationState[]> =
  {
    RUNNING: ['PAUSED', 'HALTED'],
    PAUSED: ['RUNNING', 'HALTED'],
    HALTED: [],
  };

/** Scheduled ticks run only while RUNNING; PAUSED and HALTED stop them. */
export function canSchedule(state: SimulationState): boolean {
  return state === 'RUNNING';
}

/** Manual work (Run One Cycle, Manual Trigger Job) is allowed in RUNNING and
 * PAUSED and rejected in HALTED. */
export function canRunManualWork(state: SimulationState): boolean {
  return state !== 'HALTED';
}

export function canTransition(
  from: SimulationState,
  to: SimulationState,
): boolean {
  return allowedTransitions[from].includes(to);
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
