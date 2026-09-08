import { Module } from '@nestjs/common';
import { Queue } from 'bullmq';
import { Redis as IORedis } from 'ioredis';

import { CharactersModule } from '@/characters/characters.module';
import { CommentsModule } from '@/comments/comments.module';
import {
  loadProviderConfig,
  type ProviderConfig,
} from '@/lib/llm/provider-config';
import { PostsModule } from '@/posts/posts.module';
import { CommentAction } from '@/simulation/actions/comment.action';
import { PostAction } from '@/simulation/actions/post.action';
import { SimulationContextProvider } from '@/simulation/actions/simulation-context-provider';
import { VoteAction } from '@/simulation/actions/vote.action';
import { SimulationAdminController } from '@/simulation/admin/simulation-admin.controller';
import { SimulationAdminService } from '@/simulation/admin/simulation-admin.service';
import { loadSimulationCostConfig } from '@/simulation/cost/simulation-cost';
import { SimulationCostEstimator } from '@/simulation/cost/simulation-cost-estimator';
import { SimulationLifecycleService } from '@/simulation/lifecycle/simulation-lifecycle.service';
import { SimulationLogService } from '@/simulation/logging/simulation-log.service';
import { LlmProvider } from '@/simulation/providers/llm-provider.port';
import { createLlmProvider } from '@/simulation/providers/llm-provider.registry';
import { SimulationIterationPicker } from '@/simulation/scheduler/simulation-iteration-picker';
import { SimulationRandomSource } from '@/simulation/scheduler/simulation-random-source';
import { SimulationRunner } from '@/simulation/scheduler/simulation-runner';
import { SimulationRuntimeStateService } from '@/simulation/scheduler/simulation-runtime-state.service';
import {
  SIMULATION_DLQ,
  SIMULATION_QUEUE,
  SIMULATION_REDIS,
  SIMULATION_TURNS_DLQ,
  SIMULATION_TURNS_QUEUE,
  SimulationScheduler,
} from '@/simulation/scheduler/simulation-scheduler';
import { SimulationSchedulerBootstrap } from '@/simulation/scheduler/simulation-scheduler-bootstrap';
import {
  loadSchedulerConfig,
  SCHEDULER_CONFIG,
  type SchedulerConfig,
} from '@/simulation/scheduler/simulation-scheduler-config';
import { SimulationContentWriter } from '@/simulation/writing/simulation-content-writer';
import { VotesModule } from '@/votes/votes.module';
import { WorldMembersModule } from '@/world-members/world-members.module';
import { WorldModule } from '@/world/world.module';

const LLM_PROVIDER_CONFIG = Symbol('LLM_PROVIDER_CONFIG');

@Module({
  imports: [
    WorldModule,
    CharactersModule,
    WorldMembersModule,
    PostsModule,
    CommentsModule,
    VotesModule,
  ],
  controllers: [SimulationAdminController],
  providers: [
    {
      provide: LLM_PROVIDER_CONFIG,
      useFactory: loadProviderConfig,
    },
    {
      provide: LlmProvider,
      inject: [LLM_PROVIDER_CONFIG],
      useFactory: (config: ProviderConfig) => createLlmProvider(config),
    },
    {
      provide: SimulationCostEstimator,
      useFactory: () => new SimulationCostEstimator(loadSimulationCostConfig()),
    },
    {
      provide: SCHEDULER_CONFIG,
      useFactory: () => loadSchedulerConfig(),
    },
    {
      provide: SIMULATION_REDIS,
      inject: [SCHEDULER_CONFIG],
      useFactory: (config: SchedulerConfig) =>
        new IORedis(config.redisUrl, { maxRetriesPerRequest: null }),
    },
    {
      provide: SIMULATION_QUEUE,
      inject: [SIMULATION_REDIS],
      useFactory: (connection: IORedis) =>
        new Queue(SIMULATION_TURNS_QUEUE, { connection }),
    },
    {
      provide: SIMULATION_DLQ,
      inject: [SIMULATION_REDIS],
      useFactory: (connection: IORedis) =>
        new Queue(SIMULATION_TURNS_DLQ, { connection }),
    },
    SimulationScheduler,
    SimulationContextProvider,
    PostAction,
    VoteAction,
    CommentAction,
    SimulationLifecycleService,
    SimulationLogService,
    SimulationContentWriter,
    SimulationRandomSource,
    SimulationIterationPicker,
    SimulationRuntimeStateService,
    SimulationRunner,
    SimulationSchedulerBootstrap,
    SimulationAdminService,
  ],
  exports: [
    LlmProvider,
    SimulationLifecycleService,
    SimulationScheduler,
    SimulationRunner,
  ],
})
export class SimulationModule {}
