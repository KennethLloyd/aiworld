import { SimulationState } from '@/simulation/lifecycle/domain/simulation-state';
import {
  canRunManualWork,
  canSchedule,
  canTransition,
  transitionSimulationState,
} from '@/simulation/lifecycle/simulation-lifecycle-rules';
import { InvalidSimulationStateTransitionError } from '@/simulation/lifecycle/simulation-lifecycle.error';

describe('simulation lifecycle rules', () => {
  describe('canSchedule', () => {
    it('allows scheduled work only while RUNNING', () => {
      expect(canSchedule('RUNNING')).toBe(true);
      expect(canSchedule('PAUSED')).toBe(false);
      expect(canSchedule('HALTED')).toBe(false);
    });
  });

  describe('canRunManualWork', () => {
    it('allows manual work while RUNNING or PAUSED', () => {
      expect(canRunManualWork('RUNNING')).toBe(true);
      expect(canRunManualWork('PAUSED')).toBe(true);
    });

    it('rejects manual work while HALTED', () => {
      expect(canRunManualWork('HALTED')).toBe(false);
    });
  });

  describe('canTransition', () => {
    it.each<[SimulationState, SimulationState]>([
      ['PAUSED', 'RUNNING'],
      ['RUNNING', 'PAUSED'],
      ['RUNNING', 'HALTED'],
      ['PAUSED', 'HALTED'],
      ['HALTED', 'RUNNING'],
    ])('accepts %s -> %s', (from, to) => {
      expect(canTransition(from, to)).toBe(true);
    });

    it('rejects self-transitions', () => {
      expect(canTransition('RUNNING', 'RUNNING')).toBe(false);
      expect(canTransition('PAUSED', 'PAUSED')).toBe(false);
      expect(canTransition('HALTED', 'HALTED')).toBe(false);
    });

    it('allows only an explicit restart from HALTED', () => {
      expect(canTransition('HALTED', 'RUNNING')).toBe(true);
      expect(canTransition('HALTED', 'PAUSED')).toBe(false);
    });
  });

  describe('transitionSimulationState', () => {
    it('returns the target state for a valid transition', () => {
      expect(transitionSimulationState('PAUSED', 'RUNNING')).toBe('RUNNING');
      expect(transitionSimulationState('RUNNING', 'HALTED')).toBe('HALTED');
      expect(transitionSimulationState('HALTED', 'RUNNING')).toBe('RUNNING');
    });

    it('throws for an invalid transition', () => {
      expect(() => transitionSimulationState('HALTED', 'PAUSED')).toThrow(
        InvalidSimulationStateTransitionError,
      );
      expect(() => transitionSimulationState('RUNNING', 'RUNNING')).toThrow(
        InvalidSimulationStateTransitionError,
      );
    });
  });
});
