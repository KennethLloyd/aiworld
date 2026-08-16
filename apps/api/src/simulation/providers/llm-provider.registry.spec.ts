import { loadProviderConfig, ProviderId } from '@/lib/llm/provider-config';
import { ProviderConfigurationError } from '@/lib/llm/provider-error';

import { createLlmProvider } from './llm-provider.registry';
import { MockLlmProvider } from './mock/mock-llm.provider';
import { OpenAiCompatibleLlmProvider } from './openai-compatible/openai-compatible-llm.provider';

describe('createLlmProvider', () => {
  it('selects the mock provider for mock configuration', () => {
    const provider = createLlmProvider(
      loadProviderConfig({ LLM_PROVIDER: 'mock' }),
    );

    expect(provider).toBeInstanceOf(MockLlmProvider);
  });

  it('selects the OpenAI-compatible adapter for openai-compatible configuration', () => {
    const provider = createLlmProvider(
      loadProviderConfig({
        LLM_PROVIDER: 'openai-compatible',
        LLM_BASE_URL: 'https://opencode.ai/zen/go/v1',
        LLM_API_KEY: 'fixture-api-key',
        LLM_MODEL: 'deepseek-v4-flash',
      }),
    );

    expect(provider).toBeInstanceOf(OpenAiCompatibleLlmProvider);
  });

  it('rejects an unknown provider id', () => {
    const config = loadProviderConfig({ LLM_PROVIDER: 'mock' });

    expect(() =>
      createLlmProvider({ ...config, providerId: 'unknown' as ProviderId }),
    ).toThrow(ProviderConfigurationError);
  });
});
