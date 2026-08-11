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
import { LlmProvider } from '@/simulation/providers/llm-provider.port';
import { mockLlmFixtures } from '@/simulation/providers/mock/fixtures/mock-llm-fixtures';
import { MockLlmProvider } from '@/simulation/providers/mock/mock-llm.provider';
import { WorldMembersModule } from '@/world-members/world-members.module';
import { WorldModule } from '@/world/world.module';

@Module({
  imports: [
    WorldModule,
    CharactersModule,
    WorldMembersModule,
    PostsModule,
    CommentsModule,
  ],
  providers: [
    {
      provide: LlmProvider,
      useFactory: () =>
        new MockLlmProvider(loadProviderConfig(), mockLlmFixtures),
    },
    SimulationContextProvider,
    PostAction,
    VoteAction,
    CommentAction,
    SimulationActionExecutor,
  ],
  exports: [LlmProvider, SimulationActionExecutor],
})
export class SimulationModule {}
