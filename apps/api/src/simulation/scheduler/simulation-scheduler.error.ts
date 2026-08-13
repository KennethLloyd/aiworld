/** Errors specific to composing a simulation iteration. */
export class SimulationIterationPickError extends Error {
  constructor(
    public readonly code: 'NO_ACTIVE_RESIDENTS',
    message: string,
  ) {
    super(message);
    this.name = 'SimulationIterationPickError';
  }
}
