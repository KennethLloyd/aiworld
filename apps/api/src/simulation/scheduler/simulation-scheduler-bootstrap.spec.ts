import { WorldSimulationConfigRepository } from '@/simulation/lifecycle/world-simulation-config-repository.interface';
import { SimulationSchedulerBootstrap } from '@/simulation/scheduler/simulation-scheduler-bootstrap';
import { SimulationScheduler } from '@/simulation/scheduler/simulation-scheduler.port';
import { WorldRepository } from '@/world/repositories/world-repository.interface';

describe('SimulationSchedulerBootstrap', () => {
  it('resumes only RUNNING configurations whose Worlds are active', async () => {
    const configRepository = {
      findAllByState: jest
        .fn()
        .mockResolvedValue([
          { worldId: 'active-world' },
          { worldId: 'inactive-world' },
        ]),
    } as unknown as jest.Mocked<WorldSimulationConfigRepository>;
    const worldRepository = {
      findById: jest.fn((worldId: string) =>
        Promise.resolve({ id: worldId, isActive: worldId === 'active-world' }),
      ),
    } as unknown as jest.Mocked<WorldRepository>;
    const scheduler = {
      start: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<SimulationScheduler>;
    const bootstrap = new SimulationSchedulerBootstrap(
      configRepository,
      scheduler,
      worldRepository,
    );

    await bootstrap.onModuleInit();

    expect(worldRepository.findById).toHaveBeenCalledWith('active-world');
    expect(worldRepository.findById).toHaveBeenCalledWith('inactive-world');
    expect(scheduler.start).toHaveBeenCalledTimes(1);
    expect(scheduler.start).toHaveBeenCalledWith('active-world');
  });

  it('records a resume failure without aborting boot', async () => {
    const configRepository = {
      findAllByState: jest.fn().mockResolvedValue([{ worldId: 'world-1' }]),
    } as unknown as jest.Mocked<WorldSimulationConfigRepository>;
    const worldRepository = {
      findById: jest.fn().mockResolvedValue({ id: 'world-1', isActive: true }),
    } as unknown as jest.Mocked<WorldRepository>;
    const scheduler = {
      start: jest.fn().mockRejectedValue(new Error('Redis unavailable')),
      recordBootResumeFailure: jest.fn(),
    } as unknown as jest.Mocked<SimulationScheduler>;
    const bootstrap = new SimulationSchedulerBootstrap(
      configRepository,
      scheduler,
      worldRepository,
    );

    await expect(bootstrap.onModuleInit()).resolves.toBeUndefined();

    expect(scheduler.recordBootResumeFailure).toHaveBeenCalledWith(
      'world-1',
      expect.any(Error),
    );
  });
  it('keeps boot alive when recording a resume failure also fails', async () => {
    const configRepository = {
      findAllByState: jest.fn().mockResolvedValue([{ worldId: 'world-1' }]),
    } as unknown as jest.Mocked<WorldSimulationConfigRepository>;
    const worldRepository = {
      findById: jest.fn().mockResolvedValue({ id: 'world-1', isActive: true }),
    } as unknown as jest.Mocked<WorldRepository>;
    const scheduler = {
      start: jest.fn().mockRejectedValue(new Error('Redis unavailable')),
      recordBootResumeFailure: jest
        .fn()
        .mockRejectedValue(new Error('Database unavailable')),
    } as unknown as jest.Mocked<SimulationScheduler>;
    const bootstrap = new SimulationSchedulerBootstrap(
      configRepository,
      scheduler,
      worldRepository,
    );

    await expect(bootstrap.onModuleInit()).resolves.toBeUndefined();
  });
});
