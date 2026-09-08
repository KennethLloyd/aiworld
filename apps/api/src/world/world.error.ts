export class WorldDeactivationRejectedError extends Error {
  constructor() {
    super('Cannot deactivate a World while its simulation is RUNNING');
    this.name = 'WorldDeactivationRejectedError';
  }
}
