import { Module } from '@nestjs/common';

import { loadProviderConfig } from '@/lib/llm/provider-config';
import { LlmProvider } from '@/simulation/providers/llm-provider.port';
import { mockLlmFixtures } from '@/simulation/providers/mock/fixtures/mock-llm-fixtures';
import { MockLlmProvider } from '@/simulation/providers/mock/mock-llm.provider';

@Module({
  providers: [
    {
      provide: LlmProvider,
      useFactory: () =>
        new MockLlmProvider(loadProviderConfig(), mockLlmFixtures),
    },
  ],
  exports: [LlmProvider],
})
export class SimulationModule {}
