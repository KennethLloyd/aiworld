import { SimulationLifecycleService } from '@/simulation/lifecycle/simulation-lifecycle.service';
import { SimulationScheduler } from '@/simulation/scheduler/simulation-scheduler';
import { SimulationSchedulerBootstrap } from '@/simulation/scheduler/simulation-scheduler-bootstrap';

describe('SimulationSchedulerBootstrap', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('reconciles every persisted RUNNING configuration', async () => {
    const lifecycleService = {
      findWorldIdsByState: jest
        .fn()
        .mockResolvedValue([
          { worldId: 'active-world' },
          { worldId: 'inactive-world' },
        ]),
    } as unknown as jest.Mocked<SimulationLifecycleService>;
    const scheduler = {
      ensureScheduled: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<SimulationScheduler>;
    const bootstrap = new SimulationSchedulerBootstrap(
      lifecycleService,
      scheduler,
    );

    await bootstrap.onModuleInit();

    expect(scheduler.ensureScheduled).toHaveBeenCalledTimes(2);
    expect(scheduler.ensureScheduled).toHaveBeenNthCalledWith(
      1,
      'active-world',
    );
    expect(scheduler.ensureScheduled).toHaveBeenNthCalledWith(
      2,
      'inactive-world',
    );
  });

  it('reconciles RUNNING active Worlds again every 60 seconds', async () => {
    jest.useFakeTimers();
    const lifecycleService = {
      findWorldIdsByState: jest
        .fn()
        .mockResolvedValue([{ worldId: 'world-1' }]),
    } as unknown as jest.Mocked<SimulationLifecycleService>;
    const scheduler = {
      ensureScheduled: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<SimulationScheduler>;
    const bootstrap = new SimulationSchedulerBootstrap(
      lifecycleService,
      scheduler,
    );

    await bootstrap.onModuleInit();
    scheduler.ensureScheduled.mockClear();

    await jest.advanceTimersByTimeAsync(60_000);

    expect(scheduler.ensureScheduled).toHaveBeenCalledWith('world-1');
    await bootstrap.onModuleDestroy();
  });

  it('records a resume failure without aborting boot', async () => {
    const lifecycleService = {
      findWorldIdsByState: jest
        .fn()
        .mockResolvedValue([{ worldId: 'world-1' }]),
    } as unknown as jest.Mocked<SimulationLifecycleService>;
    const scheduler = {
      ensureScheduled: jest
        .fn()
        .mockRejectedValue(new Error('Redis unavailable')),
      recordBootResumeFailure: jest.fn(),
    } as unknown as jest.Mocked<SimulationScheduler>;
    const bootstrap = new SimulationSchedulerBootstrap(
      lifecycleService,
      scheduler,
    );

    await expect(bootstrap.onModuleInit()).resolves.toBeUndefined();

    expect(scheduler.recordBootResumeFailure).toHaveBeenCalledWith(
      'world-1',
      expect.any(Error),
    );
  });
  it('keeps boot alive when recording a resume failure also fails', async () => {
    const lifecycleService = {
      findWorldIdsByState: jest
        .fn()
        .mockResolvedValue([{ worldId: 'world-1' }]),
    } as unknown as jest.Mocked<SimulationLifecycleService>;
    const scheduler = {
      ensureScheduled: jest
        .fn()
        .mockRejectedValue(new Error('Redis unavailable')),
      recordBootResumeFailure: jest
        .fn()
        .mockRejectedValue(new Error('Database unavailable')),
    } as unknown as jest.Mocked<SimulationScheduler>;
    const bootstrap = new SimulationSchedulerBootstrap(
      lifecycleService,
      scheduler,
    );

    await expect(bootstrap.onModuleInit()).resolves.toBeUndefined();
  });
});
