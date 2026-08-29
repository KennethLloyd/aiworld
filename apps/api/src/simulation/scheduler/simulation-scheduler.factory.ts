import { Queue, Worker } from 'bullmq';
import { Redis as IORedis } from 'ioredis';

import { SimulationLifecycleService } from '@/simulation/lifecycle/simulation-lifecycle.service';
import {
  BullMqSchedulerAdapter,
  SIMULATION_TICKS_DLQ,
  SIMULATION_TICKS_QUEUE,
} from '@/simulation/scheduler/bullmq-scheduler.adapter';
import { InProcessSchedulerAdapter } from '@/simulation/scheduler/in-process-scheduler.adapter';
import { SimulationCastingRepository } from '@/simulation/scheduler/simulation-casting-repository.interface';
import { SimulationIterationPicker } from '@/simulation/scheduler/simulation-iteration-picker';
import { SimulationRandomSource } from '@/simulation/scheduler/simulation-random-source';
import { SimulationRuntimeStateRepository } from '@/simulation/scheduler/simulation-runtime-state-repository.interface';
import type { SchedulerConfig } from '@/simulation/scheduler/simulation-scheduler-config';
import { SimulationScheduler } from '@/simulation/scheduler/simulation-scheduler.port';
import { SimulationTickRunner } from '@/simulation/scheduler/simulation-tick-runner';
import { WorldRepository } from '@/world/repositories/world-repository.interface';

/** Builds the SimulationScheduler for the configured adapter. The `bullmq`
 * adapter is the default runtime path: it wires the IORedis connection, the
 * tick queue, the dead-letter queue, and the concurrency-1 worker. The
 * `in-process` adapter is the test/offline override and needs no Redis. */
export function createSimulationScheduler(
  config: SchedulerConfig,
  lifecycleService: SimulationLifecycleService,
  worldRepository: WorldRepository,
  picker: SimulationIterationPicker,
  castingRepository: SimulationCastingRepository,
  randomSource: SimulationRandomSource,
  tickRunner: SimulationTickRunner,
  runtimeStateRepository: SimulationRuntimeStateRepository,
): SimulationScheduler {
  if (config.adapterId === 'in-process') {
    return new InProcessSchedulerAdapter(
      lifecycleService,
      worldRepository,
      picker,
      castingRepository,
      tickRunner,
      randomSource,
      config,
      runtimeStateRepository,
    );
  }

  const connection = new IORedis(config.redisUrl, {
    maxRetriesPerRequest: null,
  });
  const queue = new Queue(SIMULATION_TICKS_QUEUE, { connection });
  const dlq = new Queue(SIMULATION_TICKS_DLQ, { connection });
  const adapter = new BullMqSchedulerAdapter(
    config,
    lifecycleService,
    worldRepository,
    picker,
    castingRepository,
    randomSource,
    tickRunner,
    runtimeStateRepository,
    queue,
    dlq,
    connection,
  );
  const worker = new Worker(
    SIMULATION_TICKS_QUEUE,
    (job) => adapter.process(job),
    {
      connection,
      concurrency: 1,
    },
  );
  adapter.attachWorker(worker);
  return adapter;
}
