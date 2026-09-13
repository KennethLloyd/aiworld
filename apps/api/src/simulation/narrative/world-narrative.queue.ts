import { randomUUID } from 'node:crypto';

import {
  Inject,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Queue, Worker } from 'bullmq';
import { Redis as IORedis } from 'ioredis';

import { WorldNarrativeService } from '@/simulation/narrative/world-narrative.service';

export const WORLD_NARRATIVE_QUEUE = Symbol('WORLD_NARRATIVE_QUEUE');
export const WORLD_NARRATIVE_REDIS = Symbol('WORLD_NARRATIVE_REDIS');
export const WORLD_NARRATIVE_QUEUE_NAME = 'world-narrative';

type WorldNarrativeJob = { worldId: string };

@Injectable()
export class WorldNarrativeQueue implements OnModuleInit, OnModuleDestroy {
  private worker: Worker<WorldNarrativeJob> | null = null;

  constructor(
    @Inject(WORLD_NARRATIVE_QUEUE)
    private readonly queue: Queue<WorldNarrativeJob>,
    @Inject(WORLD_NARRATIVE_REDIS)
    private readonly connection: IORedis,
    private readonly narrativeService: WorldNarrativeService,
  ) {}

  onModuleInit(): void {
    this.worker = new Worker(
      WORLD_NARRATIVE_QUEUE_NAME,
      (job) => this.narrativeService.narrate(job.data.worldId),
      { connection: this.connection, concurrency: 1 },
    );
  }

  async enqueue(worldId: string): Promise<void> {
    await this.queue.add(
      `narrative_${worldId}`,
      { worldId },
      {
        jobId: `narrative_${worldId}_${randomUUID()}`,
        deduplication: { id: worldId, keepLastIfActive: true },
        attempts: 3,
        backoff: { type: 'exponential', delay: 1_000 },
        removeOnComplete: true,
        removeOnFail: false,
      },
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    await this.queue.close();
  }
}
