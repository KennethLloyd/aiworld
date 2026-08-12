import { Module } from '@nestjs/common';

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
import { SimulationContentWriter } from '@/simulation/writing/simulation-content-writer';
import { VotesModule } from '@/votes/votes.module';
import { WorldMembersModule } from '@/world-members/world-members.module';
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
    SimulationContextProvider,
    PostAction,
    VoteAction,
    CommentAction,
    SimulationActionExecutor,
    SimulationLifecycleService,
    SimulationLogService,
    SimulationContentWriter,
  ],
  exports: [
    LlmProvider,
    SimulationActionExecutor,
    SimulationLifecycleService,
    WorldSimulationConfigRepository,
  ],
})
export class SimulationModule {}
