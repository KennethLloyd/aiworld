import { z } from 'zod';

import { openAiCompatibleCompletionFixture } from '@/lib/llm/fixtures/openai-compatible-fixtures';
import { loadProviderConfig } from '@/lib/llm/provider-config';
import { ProviderCapabilityError } from '@/lib/llm/provider-error';

import {
  FetchLike,
  OpenAiCompatibleLlmProvider,
  parseRetryAfterMs,
} from './openai-compatible-llm.provider';

const okSchema = z.object({ ok: z.literal(true) });
const okPrompt = {
  system: 'Return only valid JSON with the exact shape {"ok":true}.',
  user: 'Respond with the requested health-check object.',
};

function openAiConfig(overrides: Record<string, string> = {}) {
  return loadProviderConfig({
    LLM_PROVIDER: 'openai-compatible',
    LLM_BASE_URL: 'https://opencode.ai/zen/go/v1',
    LLM_API_KEY: 'fixture-api-key',
    LLM_MODEL: 'deepseek-v4-flash',
    ...overrides,
  });
}

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

function abortError() {
  return Object.assign(new Error('The operation was aborted'), {
    name: 'AbortError',
  });
}

describe('OpenAiCompatibleLlmProvider', () => {
  it('maps the request to the OpenAI-compatible chat completions contract', async () => {
    const config = openAiConfig({ LLM_STRUCTURED_OUTPUT: 'json-object' });
    const fetchMock = jest
      .fn()
      .mockResolvedValue(jsonResponse(openAiCompatibleCompletionFixture));
    const provider = new OpenAiCompatibleLlmProvider(
      config,
      fetchMock as unknown as FetchLike,
    );

    await provider.generateStructured({
      prompt: okPrompt,
      schema: okSchema,
      temperature: 0.4,
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://opencode.ai/zen/go/v1/chat/completions');
    expect(init).toBeDefined();
    expect(init?.method).toBe('POST');
    const headers = init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer fixture-api-key');
    expect(headers['Content-Type']).toBe('application/json');

    const body = JSON.parse(init?.body as string);
    expect(body).toMatchObject({
      model: 'deepseek-v4-flash',
      messages: [
        { role: 'system', content: okPrompt.system },
        { role: 'user', content: okPrompt.user },
      ],
      temperature: 0.4,
      response_format: { type: 'json_object' },
    });
  });

  it('omits response_format in text-json-fallback mode', async () => {
    const config = openAiConfig({
      LLM_STRUCTURED_OUTPUT: 'text-json-fallback',
    });
    const fetchMock = jest.fn().mockResolvedValue(
      jsonResponse({
        ...openAiCompatibleCompletionFixture,
        choices: [
          {
            ...openAiCompatibleCompletionFixture.choices[0],
            message: {
              role: 'assistant' as const,
              content: '```json\n{"ok":true}\n```',
            },
          },
        ],
      }),
    );
    const provider = new OpenAiCompatibleLlmProvider(
      config,
      fetchMock as unknown as FetchLike,
    );

    const result = await provider.generateStructured({
      prompt: okPrompt,
      schema: okSchema,
    });

    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init?.body as string);
    expect(body.response_format).toBeUndefined();
    expect(result.output).toEqual({ ok: true });
  });

  it('normalizes a native json-object completion and its telemetry', async () => {
    const config = openAiConfig({ LLM_STRUCTURED_OUTPUT: 'json-object' });
    const fetchMock = jest
      .fn()
      .mockResolvedValue(jsonResponse(openAiCompatibleCompletionFixture));
    const provider = new OpenAiCompatibleLlmProvider(
      config,
      fetchMock as unknown as FetchLike,
    );

    const result = await provider.generateStructured({
      prompt: okPrompt,
      schema: okSchema,
    });

    expect(result.output).toEqual({ ok: true });
    expect(result.telemetry).toMatchObject({
      source: 'openai-compatible',
      model: 'deepseek-v4-flash',
      tokens: { prompt: 124, completion: 51, total: 175 },
    });
    expect(result.telemetry.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('omits tokens when usage metadata is unavailable', async () => {
    const config = openAiConfig({
      LLM_STRUCTURED_OUTPUT: 'json-object',
      LLM_USAGE_METADATA: 'unavailable',
    });
    const fetchMock = jest
      .fn()
      .mockResolvedValue(jsonResponse(openAiCompatibleCompletionFixture));
    const provider = new OpenAiCompatibleLlmProvider(
      config,
      fetchMock as unknown as FetchLike,
    );

    const result = await provider.generateStructured({
      prompt: okPrompt,
      schema: okSchema,
    });

    expect(result.telemetry.tokens).toBeUndefined();
  });

  it('omits tokens when the provider returns no usage object', async () => {
    const config = openAiConfig({ LLM_STRUCTURED_OUTPUT: 'json-object' });
    const fixture = { ...openAiCompatibleCompletionFixture };
    delete (fixture as { usage?: unknown }).usage;
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse(fixture));
    const provider = new OpenAiCompatibleLlmProvider(
      config,
      fetchMock as unknown as FetchLike,
    );

    const result = await provider.generateStructured({
      prompt: okPrompt,
      schema: okSchema,
    });

    expect(result.output).toEqual({ ok: true });
    expect(result.telemetry.tokens).toBeUndefined();
  });

  it('maps an authentication failure to a stable domain error', async () => {
    const config = openAiConfig({ LLM_STRUCTURED_OUTPUT: 'json-object' });
    const fetchMock = jest
      .fn()
      .mockResolvedValue(jsonResponse({ error: 'unauthorized' }, 401));
    const provider = new OpenAiCompatibleLlmProvider(
      config,
      fetchMock as unknown as FetchLike,
    );

    await expect(
      provider.generateStructured({ prompt: okPrompt, schema: okSchema }),
    ).rejects.toMatchObject({ code: 'AUTHENTICATION', retryable: false });
  });

  it('maps a rate limit to a retryable domain error', async () => {
    const config = openAiConfig({ LLM_STRUCTURED_OUTPUT: 'json-object' });
    const fetchMock = jest
      .fn()
      .mockResolvedValue(jsonResponse({ error: 'slow down' }, 429));
    const provider = new OpenAiCompatibleLlmProvider(
      config,
      fetchMock as unknown as FetchLike,
    );

    await expect(
      provider.generateStructured({ prompt: okPrompt, schema: okSchema }),
    ).rejects.toMatchObject({ code: 'RATE_LIMIT', retryable: true });
  });

  it('carries a Retry-After header onto the mapped rate-limit error', async () => {
    const config = openAiConfig({ LLM_STRUCTURED_OUTPUT: 'json-object' });
    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      status: 429,
      headers: { get: (name: string) => (name === 'Retry-After' ? '5' : null) },
      json: async () => ({ error: 'slow down' }),
    });
    const provider = new OpenAiCompatibleLlmProvider(
      config,
      fetchMock as unknown as FetchLike,
    );

    await expect(
      provider.generateStructured({ prompt: okPrompt, schema: okSchema }),
    ).rejects.toMatchObject({
      code: 'RATE_LIMIT',
      retryable: true,
      retryAfterMs: 5000,
    });
  });

  it('parses Retry-After delta-seconds into milliseconds', () => {
    expect(parseRetryAfterMs('5')).toBe(5000);
    expect(parseRetryAfterMs('0')).toBe(0);
    expect(parseRetryAfterMs('')).toBeUndefined();
    expect(parseRetryAfterMs(null)).toBeUndefined();
    expect(parseRetryAfterMs('Wed, 21 Oct 2015 07:28:00 GMT')).toBeUndefined();
  });

  it('maps a provider outage to a retryable network error', async () => {
    const config = openAiConfig({ LLM_STRUCTURED_OUTPUT: 'json-object' });
    const fetchMock = jest
      .fn()
      .mockResolvedValue(jsonResponse({ error: 'boom' }, 503));
    const provider = new OpenAiCompatibleLlmProvider(
      config,
      fetchMock as unknown as FetchLike,
    );

    await expect(
      provider.generateStructured({ prompt: okPrompt, schema: okSchema }),
    ).rejects.toMatchObject({ code: 'NETWORK', retryable: true });
  });

  it('maps a malformed provider response to a malformed-response error', async () => {
    const config = openAiConfig({ LLM_STRUCTURED_OUTPUT: 'json-object' });
    const fetchMock = jest
      .fn()
      .mockResolvedValue(
        jsonResponse({ ...openAiCompatibleCompletionFixture, choices: [] }),
      );
    const provider = new OpenAiCompatibleLlmProvider(
      config,
      fetchMock as unknown as FetchLike,
    );

    await expect(
      provider.generateStructured({ prompt: okPrompt, schema: okSchema }),
    ).rejects.toMatchObject({ code: 'MALFORMED_RESPONSE', retryable: false });
  });

  it('aborts the request after the configured timeout', async () => {
    const config = openAiConfig({
      LLM_STRUCTURED_OUTPUT: 'json-object',
      LLM_TIMEOUT_MS: '20',
    });
    const fetchMock = jest.fn(
      (_url: string, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(abortError()));
        }),
    );
    const provider = new OpenAiCompatibleLlmProvider(
      config,
      fetchMock as unknown as FetchLike,
    );

    await expect(
      provider.generateStructured({ prompt: okPrompt, schema: okSchema }),
    ).rejects.toMatchObject({ code: 'TIMEOUT', retryable: true });
  });

  it('rejects structured requests when structured output is unsupported', async () => {
    const config = openAiConfig({ LLM_STRUCTURED_OUTPUT: 'unsupported' });
    const fetchMock = jest.fn();
    const provider = new OpenAiCompatibleLlmProvider(
      config,
      fetchMock as unknown as FetchLike,
    );

    await expect(
      provider.generateStructured({ prompt: okPrompt, schema: okSchema }),
    ).rejects.toBeInstanceOf(ProviderCapabilityError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('explicitly rejects the unverified json-schema mode without calling the provider', async () => {
    const config = openAiConfig({ LLM_STRUCTURED_OUTPUT: 'json-schema' });
    const fetchMock = jest.fn();
    const provider = new OpenAiCompatibleLlmProvider(
      config,
      fetchMock as unknown as FetchLike,
    );

    await expect(
      provider.generateStructured({ prompt: okPrompt, schema: okSchema }),
    ).rejects.toMatchObject({ code: 'CAPABILITY', retryable: false });
    await expect(
      provider.generateStructured({ prompt: okPrompt, schema: okSchema }),
    ).rejects.toThrow('json-schema');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('never places credentials in results, requests, or errors', async () => {
    const config = openAiConfig({ LLM_STRUCTURED_OUTPUT: 'json-object' });
    const fetchMock = jest
      .fn()
      .mockResolvedValue(jsonResponse(openAiCompatibleCompletionFixture));
    const provider = new OpenAiCompatibleLlmProvider(
      config,
      fetchMock as unknown as FetchLike,
    );

    const result = await provider.generateStructured({
      prompt: okPrompt,
      schema: okSchema,
    });
    expect(JSON.stringify(result)).not.toContain('fixture-api-key');

    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.stringify(JSON.parse(init?.body as string))).not.toContain(
      'fixture-api-key',
    );

    const failingFetch = jest
      .fn()
      .mockResolvedValue(jsonResponse({ error: 'nope' }, 401));
    const failingProvider = new OpenAiCompatibleLlmProvider(
      config,
      failingFetch as unknown as FetchLike,
    );
    await expect(
      failingProvider.generateStructured({
        prompt: okPrompt,
        schema: okSchema,
      }),
    ).rejects.toThrow('Provider authentication failed');

    const error = await failingProvider
      .generateStructured({ prompt: okPrompt, schema: okSchema })
      .catch((caught: unknown) => caught);
    expect(JSON.stringify(error)).not.toContain('fixture-api-key');
  });
});
