import { loadProviderConfig } from '@/lib/llm/provider-config';
import { SimulationConfigMalformedError } from '@/simulation/lifecycle/simulation-lifecycle.error';

import { ConfiguredSimulationLlmProviderResolver } from './simulation-llm-provider.resolver';

describe('ConfiguredSimulationLlmProviderResolver', () => {
  it('uses the World provider and model with server-side process settings', () => {
    const resolver = new ConfiguredSimulationLlmProviderResolver(
      loadProviderConfig({ LLM_PROVIDER: 'mock' }),
    );

    const provider = resolver.resolve({
      worldId: 'world-1',
      providerId: 'mock',
      model: 'world-model',
    });

    expect(provider.config).toMatchObject({
      providerId: 'mock',
      model: 'world-model',
    });
    expect(provider.config.apiKey).toBeUndefined();
  });

  it('allows an OpenAI-compatible World provider when server credentials exist', () => {
    const resolver = new ConfiguredSimulationLlmProviderResolver(
      loadProviderConfig({
        LLM_PROVIDER: 'openai-compatible',
        LLM_BASE_URL: 'https://provider.example.test/v1',
        LLM_API_KEY: 'server-only-key',
        LLM_MODEL: 'process-default-model',
      }),
    );

    const provider = resolver.resolve({
      worldId: 'world-1',
      providerId: 'openai-compatible',
      model: 'world-model',
    });

    expect(provider.config).toMatchObject({
      providerId: 'openai-compatible',
      model: 'world-model',
      baseUrl: 'https://provider.example.test/v1',
    });
    expect(provider.config.apiKey).toBe('server-only-key');
  });

  it.each([
    ['unknown', 'world-model', 'providerId "unknown" is not supported'],
    ['mock', '   ', 'model must be a non-empty string'],
  ])(
    'rejects invalid World provider configuration',
    (providerId, model, detail) => {
      const resolver = new ConfiguredSimulationLlmProviderResolver(
        loadProviderConfig({ LLM_PROVIDER: 'mock' }),
      );

      expect(() =>
        resolver.resolve({ worldId: 'world-1', providerId, model }),
      ).toThrow(new SimulationConfigMalformedError('world-1', detail));
    },
  );

  it('rejects a World provider that has no server-side credentials', () => {
    const resolver = new ConfiguredSimulationLlmProviderResolver(
      loadProviderConfig({ LLM_PROVIDER: 'mock' }),
    );

    expect(() =>
      resolver.resolve({
        worldId: 'world-1',
        providerId: 'openai-compatible',
        model: 'world-model',
      }),
    ).toThrow(
      new SimulationConfigMalformedError(
        'world-1',
        'openai-compatible provider credentials are not configured on the server',
      ),
    );
  });
});
