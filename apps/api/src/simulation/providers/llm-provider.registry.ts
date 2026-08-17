import { ProviderConfig } from '@/lib/llm/provider-config';
import { ProviderConfigurationError } from '@/lib/llm/provider-error';

import { LlmProvider } from './llm-provider.port';
import { mockLlmFixtures } from './mock/fixtures/mock-llm-fixtures';
import { MockLlmProvider } from './mock/mock-llm.provider';
import { OpenAiCompatibleLlmProvider } from './openai-compatible/openai-compatible-llm.provider';
import { RetryingLlmProvider } from './retry/retrying-llm.provider';

/** Selects the base provider implementation from runtime configuration: mock
 * default, OpenAI-Compatible when configured. */
export function createBaseLlmProvider(config: ProviderConfig): LlmProvider {
  switch (config.providerId) {
    case 'mock':
      return new MockLlmProvider(config, mockLlmFixtures);
    case 'openai-compatible':
      return new OpenAiCompatibleLlmProvider(config);
    default:
      throw new ProviderConfigurationError(
        `Unknown LLM provider "${config.providerId}"`,
      );
  }
}

/** Returns a provider ready for use: the selected adapter wrapped in the
 * retry/backoff decorator. */
export function createLlmProvider(config: ProviderConfig): LlmProvider {
  return new RetryingLlmProvider(config, createBaseLlmProvider(config));
}
