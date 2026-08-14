import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';

import { SimulationActionError } from '@/simulation/actions/simulation-action.error';
import {
  InvalidSimulationStateTransitionError,
  SimulationConfigNotFoundError,
  SimulationStateConcurrentChangeError,
  SimulationWorkRejectedError,
} from '@/simulation/lifecycle/simulation-lifecycle.error';
import {
  SimulationCharacterNotActiveError,
  SimulationIterationPickError,
} from '@/simulation/scheduler/simulation-scheduler.error';

/** Maps the simulation domain errors that cross the HTTP boundary onto Nest
 * HTTP exceptions, keeping services free of HTTP vocabulary. Anything unmapped
 * re-throws so the global exception filter renders it as a 500. */
export function mapSimulationAdminError(error: unknown): never {
  if (
    error instanceof SimulationConfigNotFoundError ||
    (error instanceof SimulationActionError && error.code === 'WORLD_NOT_FOUND')
  ) {
    throw new NotFoundException();
  }

  if (error instanceof SimulationCharacterNotActiveError) {
    throw new BadRequestException(error.message);
  }

  if (
    error instanceof InvalidSimulationStateTransitionError ||
    error instanceof SimulationStateConcurrentChangeError ||
    error instanceof SimulationWorkRejectedError ||
    error instanceof SimulationIterationPickError
  ) {
    throw new ConflictException(error.message);
  }

  throw error;
}
