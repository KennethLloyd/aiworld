import {
  Injectable,
  Inject,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Queue, Worker } from 'bullmq';
import { Redis as IORedis } from 'ioredis';

import { WorldNarrativeService } from '@/simulation/narrative/world-narrative.service';
import { SIMULATION_REDIS } from '@/simulation/scheduler/simulation-redis.token';

const QUEUE_NAME = 'world-narrative';

@Injectable()
export class WorldNarrativeQueue implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WorldNarrativeQueue.name);
  private readonly queue: Queue;
  private worker: Worker | null = null;

  constructor(
    @Inject(SIMULATION_REDIS) connection: IORedis,
    private readonly narratives: WorldNarrativeService,
  ) {
    this.queue = new Queue(QUEUE_NAME, { connection });
    this.connection = connection;
  }

  private readonly connection: IORedis;

  async onModuleInit(): Promise<void> {
    await this.queue.setGlobalConcurrency(1);
    this.worker = new Worker(
      QUEUE_NAME,
      async (job) => this.narratives.process(job.data.worldId as string),
      { connection: this.connection, concurrency: 1 },
    );
    this.worker.on('failed', (_job, error) => {
      this.logger.warn(
        `Narration will retry or remain at its last saved version: ${error.message}`,
      );
    });
  }

  enqueue(worldId: string): void {
    void this.queue
      .add(
        'narrate',
        { worldId },
        {
          deduplication: { id: worldId, keepLastIfActive: true },
          attempts: 3,
          backoff: { type: 'exponential', delay: 1000 },
          removeOnComplete: true,
          removeOnFail: false,
        },
      )
      .catch((error: unknown) => {
        this.logger.warn(
          `Could not queue narration: ${error instanceof Error ? error.message : 'unknown error'}`,
        );
      });
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.queue.close();
  }
}
