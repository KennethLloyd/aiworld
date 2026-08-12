import { SimulationState } from '@/simulation/lifecycle/domain/simulation-state';

export class SimulationConfigNotFoundError extends Error {
  constructor(worldId: string) {
    super(`No simulation configuration found for world ${worldId}`);
    this.name = 'SimulationConfigNotFoundError';
  }
}

export class InvalidSimulationStateTransitionError extends Error {
  constructor(from: SimulationState, to: SimulationState) {
    super(`Invalid simulation state transition: ${from} -> ${to}`);
    this.name = 'InvalidSimulationStateTransitionError';
  }
}

/** A transition read the persisted state, validated it, and then the state
 * changed before the update landed. The caller must re-read and re-decide. */
export class SimulationStateConcurrentChangeError extends Error {
  constructor(
    worldId: string,
    from: SimulationState,
    persisted: SimulationState,
  ) {
    super(
      `Simulation state for world ${worldId} changed concurrently: ` +
        `expected ${from} but persisted state is ${persisted}`,
    );
    this.name = 'SimulationStateConcurrentChangeError';
  }
}

export type SimulationWorkKind = 'MANUAL' | 'SCHEDULED';

/** A lifecycle gate rejected work because the persisted state does not allow
 * it: manual work is rejected in HALTED, scheduled work outside RUNNING. */
export class SimulationWorkRejectedError extends Error {
  constructor(
    public readonly kind: SimulationWorkKind,
    state: SimulationState,
  ) {
    super(
      `Simulation ${kind.toLowerCase()} work is rejected in state ${state}`,
    );
    this.name = 'SimulationWorkRejectedError';
  }
}

export class SimulationConfigMalformedError extends Error {
  constructor(worldId: string, detail: string) {
    super(
      `Simulation configuration for world ${worldId} is malformed: ${detail}`,
    );
    this.name = 'SimulationConfigMalformedError';
  }
}
