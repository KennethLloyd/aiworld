import { Module } from '@nestjs/common';
import { Queue, Worker } from 'bullmq';
import { Redis as IORedis } from 'ioredis';

import { CharactersModule } from '@/characters/characters.module';
import { CommentsModule } from '@/comments/comments.module';
import { loadProviderConfig } from '@/lib/llm/provider-config';
import { PostsModule } from '@/posts/posts.module';
import { CommentAction } from '@/simulation/actions/comment.action';
import { PostAction } from '@/simulation/actions/post.action';
import { SimulationActionExecutor } from '@/simulation/actions/simulation-action-executor';
import { SimulationContextProvider } from '@/simulation/actions/simulation-context-provider';
import { VoteAction } from '@/simulation/actions/vote.action';
import { loadSimulationCostConfig } from '@/simulation/cost/simulation-cost';
import { SimulationCostEstimator } from '@/simulation/cost/simulation-cost-estimator';
import { PrismaWorldSimulationConfigRepository } from '@/simulation/lifecycle/prisma-world-simulation-config.repository';
import { SimulationLifecycleService } from '@/simulation/lifecycle/simulation-lifecycle.service';
import { WorldSimulationConfigRepository } from '@/simulation/lifecycle/world-simulation-config-repository.interface';
import { PrismaSimulationLogRepository } from '@/simulation/logging/prisma-simulation-log.repository';
import { SimulationLogRepository } from '@/simulation/logging/simulation-log-repository.interface';
import { SimulationLogService } from '@/simulation/logging/simulation-log.service';
import { LlmProvider } from '@/simulation/providers/llm-provider.port';
import { mockLlmFixtures } from '@/simulation/providers/mock/fixtures/mock-llm-fixtures';
import { MockLlmProvider } from '@/simulation/providers/mock/mock-llm.provider';
import {
  BullMqSchedulerAdapter,
  SIMULATION_TICKS_DLQ,
  SIMULATION_TICKS_QUEUE,
} from '@/simulation/scheduler/bullmq-scheduler.adapter';
import { InProcessSchedulerAdapter } from '@/simulation/scheduler/in-process-scheduler.adapter';
import { PrismaSimulationCastingRepository } from '@/simulation/scheduler/prisma-simulation-casting.repository';
import { SimulationCastingRepository } from '@/simulation/scheduler/simulation-casting-repository.interface';
import { SimulationIterationPicker } from '@/simulation/scheduler/simulation-iteration-picker';
import { SimulationRandomSource } from '@/simulation/scheduler/simulation-random-source';
import { SimulationSchedulerBootstrap } from '@/simulation/scheduler/simulation-scheduler-bootstrap';
import {
  loadSchedulerConfig,
  SCHEDULER_CONFIG,
  type SchedulerConfig,
} from '@/simulation/scheduler/simulation-scheduler-config';
import { SimulationScheduler } from '@/simulation/scheduler/simulation-scheduler.port';
import { SimulationTickRunner } from '@/simulation/scheduler/simulation-tick-runner';
import { SimulationContentWriter } from '@/simulation/writing/simulation-content-writer';
import { VotesModule } from '@/votes/votes.module';
import { WorldMembersModule } from '@/world-members/world-members.module';
import { WorldRepository } from '@/world/repositories/world-repository.interface';
import { WorldModule } from '@/world/world.module';

@Module({
  imports: [
    WorldModule,
    CharactersModule,
    WorldMembersModule,
    PostsModule,
    CommentsModule,
    VotesModule,
  ],
  providers: [
    {
      provide: LlmProvider,
      useFactory: () =>
        new MockLlmProvider(loadProviderConfig(), mockLlmFixtures),
    },
    {
      provide: SimulationCostEstimator,
      useFactory: () => new SimulationCostEstimator(loadSimulationCostConfig()),
    },
    {
      provide: SimulationLogRepository,
      useClass: PrismaSimulationLogRepository,
    },
    {
      provide: WorldSimulationConfigRepository,
      useClass: PrismaWorldSimulationConfigRepository,
    },
    {
      provide: SCHEDULER_CONFIG,
      useFactory: () => loadSchedulerConfig(),
    },
    {
      provide: SimulationCastingRepository,
      useClass: PrismaSimulationCastingRepository,
    },
    {
      provide: SimulationScheduler,
      inject: [
        SCHEDULER_CONFIG,
        SimulationLifecycleService,
        WorldRepository,
        SimulationIterationPicker,
        SimulationRandomSource,
        SimulationTickRunner,
      ],
      useFactory: (
        config: SchedulerConfig,
        lifecycleService: SimulationLifecycleService,
        worldRepository: WorldRepository,
        picker: SimulationIterationPicker,
        randomSource: SimulationRandomSource,
        tickRunner: SimulationTickRunner,
      ) => {
        if (config.adapterId === 'in-process') {
          return new InProcessSchedulerAdapter(
            lifecycleService,
            worldRepository,
            picker,
            tickRunner,
            randomSource,
            config,
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
          randomSource,
          tickRunner,
          queue,
          dlq,
          connection,
        );
        const worker = new Worker(
          SIMULATION_TICKS_QUEUE,
          (job) => adapter.process(job),
          { connection, concurrency: 1 },
        );
        adapter.attachWorker(worker);
        return adapter;
      },
    },
    SimulationContextProvider,
    PostAction,
    VoteAction,
    CommentAction,
    SimulationActionExecutor,
    SimulationLifecycleService,
    SimulationLogService,
    SimulationContentWriter,
    SimulationRandomSource,
    SimulationIterationPicker,
    SimulationTickRunner,
    SimulationSchedulerBootstrap,
  ],
  exports: [
    LlmProvider,
    SimulationActionExecutor,
    SimulationLifecycleService,
    WorldSimulationConfigRepository,
    SimulationScheduler,
    SimulationTickRunner,
  ],
})
export class SimulationModule {}
