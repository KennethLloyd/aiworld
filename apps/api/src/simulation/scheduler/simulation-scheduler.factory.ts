import { Queue, Worker } from 'bullmq';
import { Redis as IORedis } from 'ioredis';

import { SimulationLifecycleService } from '@/simulation/lifecycle/simulation-lifecycle.service';
import {
  BullMqSchedulerAdapter,
  SIMULATION_TICKS_DLQ,
  SIMULATION_TICKS_QUEUE,
} from '@/simulation/scheduler/bullmq-scheduler.adapter';
import { SimulationCastingRepository } from '@/simulation/scheduler/simulation-casting-repository.interface';
import { SimulationIterationPicker } from '@/simulation/scheduler/simulation-iteration-picker';
import { SimulationRandomSource } from '@/simulation/scheduler/simulation-random-source';
import { SimulationRunner } from '@/simulation/scheduler/simulation-runner';
import { SimulationRuntimeStateRepository } from '@/simulation/scheduler/simulation-runtime-state-repository.interface';
import type { SchedulerConfig } from '@/simulation/scheduler/simulation-scheduler-config';
import { SimulationScheduler } from '@/simulation/scheduler/simulation-scheduler.port';
import { WorldRepository } from '@/world/repositories/world-repository.interface';

/** Builds the configured scheduler adapter. */
export function createSimulationScheduler(
  config: SchedulerConfig,
  lifecycleService: SimulationLifecycleService,
  worldRepository: WorldRepository,
  picker: SimulationIterationPicker,
  castingRepository: SimulationCastingRepository,
  randomSource: SimulationRandomSource,
  runner: SimulationRunner,
  runtimeStateRepository: SimulationRuntimeStateRepository,
): SimulationScheduler {
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
    runner,
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
