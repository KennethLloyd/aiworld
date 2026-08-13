import { SimulationState } from '@/simulation/lifecycle/domain/simulation-state';
import { WorldSimulationConfigRecord } from '@/simulation/lifecycle/domain/world-simulation-config-record';
import {
  SimulationConfigNotFoundError,
  SimulationStateConcurrentChangeError,
  SimulationWorkRejectedError,
} from '@/simulation/lifecycle/simulation-lifecycle.error';
import { SimulationLifecycleService } from '@/simulation/lifecycle/simulation-lifecycle.service';
import { WorldSimulationConfigRepository } from '@/simulation/lifecycle/world-simulation-config-repository.interface';
import { SimulationScheduler } from '@/simulation/scheduler/simulation-scheduler.port';

function configRecord(
  overrides: Partial<WorldSimulationConfigRecord> = {},
): WorldSimulationConfigRecord {
  return {
    id: 'config-1',
    worldId: 'world-1',
    state: 'PAUSED',
    speedMultiplier: 1,
    intervalMs: 30000,
    jitterMs: 5000,
    actionWeights: { POST: 0.2, VOTE: 0.5, COMMENT: 0.3 },
    providerId: 'mock',
    model: 'fixture-model',
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
    updatedAt: new Date('2026-08-01T00:00:00.000Z'),
    ...overrides,
  };
}

function createService(state: SimulationState = 'PAUSED') {
  const repository = {
    findByWorldId: jest.fn(),
    findAllByState: jest.fn(),
    transitionState: jest.fn(),
  } as unknown as jest.Mocked<WorldSimulationConfigRepository>;
  const scheduler = {
    start: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<SimulationScheduler>;
  const service = new SimulationLifecycleService(repository, scheduler);
  return { service, repository, scheduler, persisted: configRecord({ state }) };
}

describe('SimulationLifecycleService', () => {
  it('reads configuration by world id from the repository', async () => {
    const { service, repository, persisted } = createService();
    repository.findByWorldId.mockResolvedValue(persisted);

    const result = await service.getByWorldId('world-1');

    expect(result).toEqual(persisted);
    expect(repository.findByWorldId).toHaveBeenCalledWith('world-1');
  });

  it('returns null when no configuration is persisted', async () => {
    const { service, repository } = createService();
    repository.findByWorldId.mockResolvedValue(null);

    await expect(service.getByWorldId('missing')).resolves.toBeNull();
  });

  describe('transitionTo', () => {
    it('validates against the persisted state and persists the target', async () => {
      const { service, repository, persisted } = createService('PAUSED');
      repository.findByWorldId.mockResolvedValue(persisted);
      repository.transitionState.mockResolvedValue(
        configRecord({ state: 'RUNNING' }),
      );

      const result = await service.transitionTo('world-1', 'RUNNING');

      expect(result.state).toBe('RUNNING');
      expect(repository.findByWorldId).toHaveBeenCalledWith('world-1');
      expect(repository.transitionState).toHaveBeenCalledWith(
        'world-1',
        'PAUSED',
        'RUNNING',
      );
    });

    it('waits for the persisted transition before reporting success', async () => {
      const { service, repository, persisted } = createService('PAUSED');
      repository.findByWorldId.mockResolvedValue(persisted);
      const updated = configRecord({ state: 'RUNNING' });
      repository.transitionState.mockResolvedValue(updated);

      await expect(service.start('world-1')).resolves.toEqual(updated);
    });

    it('rejects an invalid transition without persisting', async () => {
      const { service, repository, persisted } = createService('HALTED');
      repository.findByWorldId.mockResolvedValue(persisted);

      await expect(service.transitionTo('world-1', 'RUNNING')).rejects.toThrow(
        'Invalid simulation state transition',
      );
      expect(repository.transitionState).not.toHaveBeenCalled();
    });

    it('surfaces a concurrent state change from the repository', async () => {
      const { service, repository, persisted } = createService('PAUSED');
      repository.findByWorldId.mockResolvedValue(persisted);
      repository.transitionState.mockRejectedValue(
        new SimulationStateConcurrentChangeError('world-1', 'PAUSED', 'HALTED'),
      );

      await expect(service.transitionTo('world-1', 'RUNNING')).rejects.toThrow(
        SimulationStateConcurrentChangeError,
      );
    });

    it('throws when the world has no persisted configuration', async () => {
      const { service, repository } = createService();
      repository.findByWorldId.mockResolvedValue(null);

      await expect(service.transitionTo('missing', 'RUNNING')).rejects.toThrow(
        SimulationConfigNotFoundError,
      );
      expect(repository.transitionState).not.toHaveBeenCalled();
    });

    it('persists RUNNING on start', async () => {
      const { service, repository, persisted } = createService('PAUSED');
      repository.findByWorldId.mockResolvedValue(persisted);

      await service.start('world-1');

      expect(repository.transitionState).toHaveBeenCalledWith(
        'world-1',
        'PAUSED',
        'RUNNING',
      );
    });

    it('persists PAUSED on pause', async () => {
      const { service, repository, persisted } = createService('RUNNING');
      repository.findByWorldId.mockResolvedValue(persisted);

      await service.pause('world-1');

      expect(repository.transitionState).toHaveBeenCalledWith(
        'world-1',
        'RUNNING',
        'PAUSED',
      );
    });

    it('persists HALTED on halt from RUNNING and PAUSED', async () => {
      for (const state of ['RUNNING', 'PAUSED'] as const) {
        const { service, repository, persisted } = createService(state);
        repository.findByWorldId.mockResolvedValue(persisted);

        await service.halt('world-1');

        expect(repository.transitionState).toHaveBeenCalledWith(
          'world-1',
          state,
          'HALTED',
        );
      }
    });
  });

  describe('scheduler drive', () => {
    it('starts the scheduler after persisting RUNNING', async () => {
      const { service, repository, scheduler, persisted } =
        createService('PAUSED');
      repository.findByWorldId.mockResolvedValue(persisted);
      repository.transitionState.mockResolvedValue(
        configRecord({ state: 'RUNNING' }),
      );

      await service.start('world-1');

      expect(scheduler.start).toHaveBeenCalledWith('world-1');
      expect(scheduler.stop).not.toHaveBeenCalled();
    });

    it.each(['PAUSED', 'HALTED'] as const)(
      'stops the scheduler after persisting %s',
      async (target) => {
        const { service, repository, scheduler, persisted } =
          createService('RUNNING');
        repository.findByWorldId.mockResolvedValue(persisted);
        repository.transitionState.mockResolvedValue(
          configRecord({ state: target }),
        );

        await service.transitionTo('world-1', target);

        expect(scheduler.stop).toHaveBeenCalledWith('world-1');
        expect(scheduler.start).not.toHaveBeenCalled();
      },
    );

    it('does not drive the scheduler on an invalid transition', async () => {
      const { service, repository, scheduler, persisted } =
        createService('HALTED');
      repository.findByWorldId.mockResolvedValue(persisted);

      await expect(service.transitionTo('world-1', 'RUNNING')).rejects.toThrow(
        'Invalid simulation state transition',
      );

      expect(scheduler.start).not.toHaveBeenCalled();
      expect(scheduler.stop).not.toHaveBeenCalled();
    });
  });

  describe('assertManualWorkAllowed', () => {
    it.each(['RUNNING', 'PAUSED'] as const)(
      'allows manual work while %s',
      async (state) => {
        const { service, repository, persisted } = createService(state);
        repository.findByWorldId.mockResolvedValue(persisted);

        const result = await service.assertManualWorkAllowed('world-1');

        expect(result).toEqual(persisted);
      },
    );

    it('rejects manual work while HALTED', async () => {
      const { service, repository, persisted } = createService('HALTED');
      repository.findByWorldId.mockResolvedValue(persisted);

      const rejection = service.assertManualWorkAllowed('world-1');

      await expect(rejection).rejects.toThrow(SimulationWorkRejectedError);
      await expect(rejection).rejects.toMatchObject({ kind: 'MANUAL' });
      expect(repository.findByWorldId).toHaveBeenCalledWith('world-1');
    });
  });

  describe('assertScheduledWorkAllowed', () => {
    it('allows scheduled work only while RUNNING', async () => {
      const { service, repository, persisted } = createService('RUNNING');
      repository.findByWorldId.mockResolvedValue(persisted);

      const result = await service.assertScheduledWorkAllowed('world-1');

      expect(result).toEqual(persisted);
    });

    it.each(['PAUSED', 'HALTED'] as const)(
      'rejects scheduled work while %s',
      async (state) => {
        const { service, repository, persisted } = createService(state);
        repository.findByWorldId.mockResolvedValue(persisted);

        const rejection = service.assertScheduledWorkAllowed('world-1');

        await expect(rejection).rejects.toThrow(SimulationWorkRejectedError);
        await expect(rejection).rejects.toMatchObject({ kind: 'SCHEDULED' });
      },
    );
  });
});
