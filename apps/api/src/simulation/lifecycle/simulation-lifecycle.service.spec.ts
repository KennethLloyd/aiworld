import { createDefaultSimulationConfig } from '@/lib/config/simulation-config-defaults';
import { SimulationState } from '@/simulation/lifecycle/domain/simulation-state';
import { WorldSimulationConfigRecord } from '@/simulation/lifecycle/domain/world-simulation-config-record';
import {
  SimulationConfigNotFoundError,
  SimulationWorkRejectedError,
} from '@/simulation/lifecycle/simulation-lifecycle.error';
import { SimulationLifecycleService } from '@/simulation/lifecycle/simulation-lifecycle.service';
import { WorldSimulationConfigRepository } from '@/simulation/lifecycle/world-simulation-config-repository.interface';
import { WorldRepository } from '@/world/repositories/world-repository.interface';

function configRecord(
  overrides: Partial<WorldSimulationConfigRecord> = {},
): WorldSimulationConfigRecord {
  return {
    id: 'config-1',
    worldId: 'world-1',
    ...createDefaultSimulationConfig(),
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
    updatedAt: new Date('2026-08-01T00:00:00.000Z'),
    ...overrides,
  };
}

function createService(state: SimulationState = 'PAUSED', isActive = true) {
  const repository = {
    findByWorldId: jest.fn(),
    findAllByState: jest.fn(),
    setState: jest.fn(),
    updateSpeedMultiplier: jest.fn(),
  } as unknown as jest.Mocked<WorldSimulationConfigRepository>;
  const worldRepository = {
    findById: jest.fn().mockResolvedValue({ id: 'world-1', isActive }),
  } as unknown as jest.Mocked<WorldRepository>;
  const service = new SimulationLifecycleService(repository, worldRepository);
  return {
    service,
    repository,
    worldRepository,
    persisted: configRecord({ state }),
  };
}

describe('SimulationLifecycleService', () => {
  it('reads configuration by World id', async () => {
    const { service, repository, persisted } = createService();
    repository.findByWorldId.mockResolvedValue(persisted);

    await expect(service.getByWorldId('world-1')).resolves.toEqual(persisted);
  });

  it('persists a RUNNING desired state after confirming the World is active', async () => {
    const { service, repository, persisted } = createService('PAUSED');
    repository.findByWorldId.mockResolvedValue(persisted);
    repository.setState.mockResolvedValue(configRecord({ state: 'RUNNING' }));

    await service.start('world-1');

    expect(repository.setState).toHaveBeenCalledWith('world-1', 'RUNNING');
  });

  it.each(['RUNNING', 'PAUSED', 'HALTED'] as const)(
    'does not write when a lifecycle operation already has the desired state (%s)',
    async (state) => {
      const { service, repository, persisted } = createService(state);
      repository.findByWorldId.mockResolvedValue(persisted);

      await expect(service.transitionTo('world-1', state)).resolves.toEqual(
        persisted,
      );
      expect(repository.setState).not.toHaveBeenCalled();
    },
  );

  it('allows valid desired-state transitions', async () => {
    for (const [state, target] of [
      ['RUNNING', 'PAUSED'],
      ['RUNNING', 'HALTED'],
      ['PAUSED', 'HALTED'],
      ['HALTED', 'RUNNING'],
    ] as const) {
      const { service, repository, persisted } = createService(state);
      repository.findByWorldId.mockResolvedValue(persisted);
      repository.setState.mockResolvedValue(configRecord({ state: target }));

      await service.transitionTo('world-1', target);

      expect(repository.setState).toHaveBeenCalledWith('world-1', target);
    }
  });

  it('rejects an invalid desired-state transition', async () => {
    const { service, repository, persisted } = createService('HALTED');
    repository.findByWorldId.mockResolvedValue(persisted);

    await expect(service.transitionTo('world-1', 'PAUSED')).rejects.toThrow(
      'Invalid simulation state transition',
    );
    expect(repository.setState).not.toHaveBeenCalled();
  });

  it('rejects starting an inactive World without changing desired state', async () => {
    const { service, repository, persisted } = createService('PAUSED', false);
    repository.findByWorldId.mockResolvedValue(persisted);

    await expect(service.start('world-1')).rejects.toMatchObject({
      kind: 'LIFECYCLE',
      reason: 'INACTIVE',
    });
    expect(repository.setState).not.toHaveBeenCalled();
  });

  it('throws when a World has no persisted configuration', async () => {
    const { service, repository } = createService();
    repository.findByWorldId.mockResolvedValue(null);

    await expect(service.start('missing')).rejects.toThrow(
      SimulationConfigNotFoundError,
    );
  });

  it('updates the speed multiplier through the repository', async () => {
    const { service, repository, persisted } = createService();
    repository.findByWorldId.mockResolvedValue(persisted);
    repository.updateSpeedMultiplier.mockResolvedValue({
      ...persisted,
      speedMultiplier: 2,
    });

    await expect(service.updateSpeed('world-1', 2)).resolves.toMatchObject({
      speedMultiplier: 2,
    });
  });

  it.each(['RUNNING', 'PAUSED'] as const)(
    'allows manual work while %s',
    async (state) => {
      const { service, repository, persisted } = createService(state);
      repository.findByWorldId.mockResolvedValue(persisted);

      await expect(service.assertManualWorkAllowed('world-1')).resolves.toEqual(
        persisted,
      );
    },
  );

  it('rejects manual work while HALTED', async () => {
    const { service, repository, persisted } = createService('HALTED');
    repository.findByWorldId.mockResolvedValue(persisted);

    await expect(service.assertManualWorkAllowed('world-1')).rejects.toEqual(
      expect.any(SimulationWorkRejectedError),
    );
  });

  it('rejects manual work for an inactive World', async () => {
    const { service, repository, persisted } = createService('PAUSED', false);
    repository.findByWorldId.mockResolvedValue(persisted);

    await expect(
      service.assertManualWorkAllowed('world-1'),
    ).rejects.toMatchObject({ reason: 'INACTIVE' });
  });

  it('allows scheduled work only while RUNNING', async () => {
    const { service, repository, persisted } = createService('RUNNING');
    repository.findByWorldId.mockResolvedValue(persisted);

    await expect(
      service.assertScheduledWorkAllowed('world-1'),
    ).resolves.toEqual(persisted);
  });

  it.each(['PAUSED', 'HALTED'] as const)(
    'rejects scheduled work while %s',
    async (state) => {
      const { service, repository, persisted } = createService(state);
      repository.findByWorldId.mockResolvedValue(persisted);

      await expect(
        service.assertScheduledWorkAllowed('world-1'),
      ).rejects.toMatchObject({ kind: 'SCHEDULED' });
    },
  );
});
