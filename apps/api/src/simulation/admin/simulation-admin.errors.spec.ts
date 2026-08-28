import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';

import { SimulationActionError } from '@/simulation/actions/simulation-action.error';
import { mapSimulationAdminError } from '@/simulation/admin/simulation-admin.errors';
import {
  InvalidSimulationStateTransitionError,
  SimulationConfigMalformedError,
  SimulationConfigNotFoundError,
  SimulationStateConcurrentChangeError,
  SimulationWorkRejectedError,
} from '@/simulation/lifecycle/simulation-lifecycle.error';
import { SimulationCharacterNotActiveError } from '@/simulation/scheduler/simulation-scheduler.error';
import { SimulationIterationPickError } from '@/simulation/scheduler/simulation-scheduler.error';

describe('mapSimulationAdminError', () => {
  it('maps a missing config or world to 404', () => {
    expect(() =>
      mapSimulationAdminError(new SimulationConfigNotFoundError('world-1')),
    ).toThrow(NotFoundException);
    expect(() =>
      mapSimulationAdminError(
        new SimulationActionError('WORLD_NOT_FOUND', 'World "x" was not found'),
      ),
    ).toThrow(NotFoundException);
  });

  it('maps malformed configuration to 400 with a clear message', () => {
    expect(() =>
      mapSimulationAdminError(
        new SimulationConfigMalformedError(
          'world-1',
          'actionWeights must be { POST, VOTE, COMMENT } numbers',
        ),
      ),
    ).toThrow('Simulation configuration for world world-1 is malformed');
  });

  it('maps invalid transitions and concurrent changes to 409', () => {
    expect(() =>
      mapSimulationAdminError(
        new InvalidSimulationStateTransitionError('HALTED', 'RUNNING'),
      ),
    ).toThrow(ConflictException);
    expect(() =>
      mapSimulationAdminError(
        new SimulationStateConcurrentChangeError('world-1', 'PAUSED', 'HALTED'),
      ),
    ).toThrow(ConflictException);
  });

  it('maps manual-work rejection (HALTED) to 409', () => {
    expect(() =>
      mapSimulationAdminError(
        new SimulationWorkRejectedError('MANUAL', 'HALTED'),
      ),
    ).toThrow(ConflictException);
  });

  it('maps a picker failure (no active characters) to 409', () => {
    expect(() =>
      mapSimulationAdminError(
        new SimulationIterationPickError(
          'NO_ACTIVE_CHARACTERS',
          'World "world-1" has no active AI characters to act',
        ),
      ),
    ).toThrow(ConflictException);
  });

  it('maps a custom-action character outside the world to 400', () => {
    expect(() =>
      mapSimulationAdminError(
        new SimulationCharacterNotActiveError('character-9', 'mbti-house'),
      ),
    ).toThrow(BadRequestException);
  });

  it('re-throws unmapped errors', () => {
    const error = new Error('boom');
    expect(() => mapSimulationAdminError(error)).toThrow(error);
  });
});
