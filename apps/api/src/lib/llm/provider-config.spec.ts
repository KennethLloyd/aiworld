import {
  assertStructuredOutputCapability,
  assertStructuredOutputEnabled,
  loadProviderConfig,
  toSafeProviderConfig,
} from './provider-config.js';
import { ProviderCapabilityError } from './provider-error.js';

describe('loadProviderConfig', () => {
  it('defaults to a network-free mock configuration', () => {
    expect(loadProviderConfig({})).toEqual({
      providerId: 'mock',
      model: 'mock',
      timeoutMs: 30_000,
      maxRetries: 2,
      maxConcurrency: 1,
      capabilities: {
        structuredOutput: 'text-json-fallback',
        usageMetadata: 'optional',
      },
    });
  });

  it('treats empty-string settings as absent', () => {
    expect(
      loadProviderConfig({
        LLM_PROVIDER: '',
        LLM_MODEL: '',
        LLM_STRUCTURED_OUTPUT: '',
      }),
    ).toEqual({
      providerId: 'mock',
      model: 'mock',
      timeoutMs: 30_000,
      maxRetries: 2,
      maxConcurrency: 1,
      capabilities: {
        structuredOutput: 'text-json-fallback',
        usageMetadata: 'optional',
      },
    });
  });

  it('requires connection settings for non-mock providers', () => {
    expect(() =>
      loadProviderConfig({ LLM_PROVIDER: 'openai-compatible' }),
    ).toThrow('LLM_BASE_URL, LLM_API_KEY, LLM_MODEL');
  });

  it('loads a runtime-selectable OpenAI-compatible profile', () => {
    const config = loadProviderConfig({
      LLM_PROVIDER: 'openai-compatible',
      LLM_BASE_URL: 'https://opencode.ai/zen/go/v1/',
      LLM_API_KEY: 'fixture-api-key',
      LLM_MODEL: 'deepseek-v4-flash',
      LLM_TIMEOUT_MS: '45000',
      LLM_MAX_RETRIES: '3',
      LLM_MAX_CONCURRENCY: '2',
      LLM_STRUCTURED_OUTPUT: 'json-object',
      LLM_USAGE_METADATA: 'optional',
    });

    expect(config).toMatchObject({
      providerId: 'openai-compatible',
      baseUrl: 'https://opencode.ai/zen/go/v1',
      model: 'deepseek-v4-flash',
      timeoutMs: 45_000,
      maxRetries: 3,
      maxConcurrency: 2,
      capabilities: {
        structuredOutput: 'json-object',
        usageMetadata: 'optional',
      },
    });
    expect(config.apiKey).toBe('fixture-api-key');
  });

  it('redacts credentials from safe configuration metadata', () => {
    const config = loadProviderConfig({
      LLM_PROVIDER: 'openai-compatible',
      LLM_BASE_URL: 'https://opencode.ai/zen/go/v1',
      LLM_API_KEY: 'fixture-api-key',
      LLM_MODEL: 'deepseek-v4-flash',
    });

    expect(toSafeProviderConfig(config)).toEqual({
      providerId: 'openai-compatible',
      baseUrl: 'https://opencode.ai/zen/go/v1',
      model: 'deepseek-v4-flash',
      timeoutMs: 30_000,
      maxRetries: 2,
      maxConcurrency: 1,
      capabilities: {
        structuredOutput: 'text-json-fallback',
        usageMetadata: 'optional',
      },
      hasApiKey: true,
    });
    expect(JSON.stringify(toSafeProviderConfig(config))).not.toContain(
      'fixture-api-key',
    );
  });

  it('rejects invalid numeric settings without exposing values', () => {
    expect(() =>
      loadProviderConfig({
        LLM_PROVIDER: 'openai-compatible',
        LLM_BASE_URL: 'https://example.com/v1',
        LLM_API_KEY: 'fixture-api-key',
        LLM_MODEL: 'test-model',
        LLM_TIMEOUT_MS: '0',
      }),
    ).toThrow('Invalid LLM provider configuration');
  });

  it('raises a capability error when a native output mode is unavailable', () => {
    const config = loadProviderConfig({
      LLM_PROVIDER: 'openai-compatible',
      LLM_BASE_URL: 'https://opencode.ai/zen/go/v1',
      LLM_API_KEY: 'fixture-api-key',
      LLM_MODEL: 'deepseek-v4-flash',
      LLM_STRUCTURED_OUTPUT: 'json-object',
    });

    expect(() =>
      assertStructuredOutputCapability(config, 'json-object'),
    ).not.toThrow();
    expect(() =>
      assertStructuredOutputCapability(config, 'json-schema'),
    ).toThrow('native json-schema structured output');
  });
});

describe('assertStructuredOutputEnabled', () => {
  it('allows json-object generation', () => {
    const config = loadProviderConfig({
      LLM_PROVIDER: 'mock',
      LLM_STRUCTURED_OUTPUT: 'json-object',
    });

    expect(() => assertStructuredOutputEnabled(config)).not.toThrow();
  });

  it('rejects the unverified json-schema mode explicitly', () => {
    const config = loadProviderConfig({
      LLM_PROVIDER: 'mock',
      LLM_STRUCTURED_OUTPUT: 'json-schema',
    });

    expect(() => assertStructuredOutputEnabled(config)).toThrow(
      ProviderCapabilityError,
    );
    expect(() => assertStructuredOutputEnabled(config)).toThrow('json-schema');
  });

  it('allows text-json-fallback generation', () => {
    const config = loadProviderConfig({
      LLM_PROVIDER: 'mock',
      LLM_STRUCTURED_OUTPUT: 'text-json-fallback',
    });

    expect(() => assertStructuredOutputEnabled(config)).not.toThrow();
  });

  it('rejects generation when structured output is unsupported', () => {
    const config = loadProviderConfig({
      LLM_PROVIDER: 'mock',
      LLM_STRUCTURED_OUTPUT: 'unsupported',
    });

    expect(() => assertStructuredOutputEnabled(config)).toThrow(
      ProviderCapabilityError,
    );
  });
});
