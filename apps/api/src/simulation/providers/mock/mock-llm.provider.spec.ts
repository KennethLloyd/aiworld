import { z } from 'zod';

import { loadProviderConfig } from '@/lib/llm/provider-config';
import {
  ProviderCapabilityError,
  ProviderMalformedResponseError,
} from '@/lib/llm/provider-error';

import { MockLlmProvider } from './mock-llm.provider';

const voteSchema = z.object({
  decision: z.enum(['upvote', 'downvote', 'skip']),
});

const votePrompt = {
  system: 'Simulate a VOTE action for the current World.',
  user: 'Post: "A quiet thought about timing."',
};

function mockConfig(overrides: Record<string, string> = {}) {
  return loadProviderConfig({
    LLM_PROVIDER: 'mock',
    LLM_MODEL: 'fixture-model',
    ...overrides,
  });
}

describe('MockLlmProvider', () => {
  it('returns the same output and telemetry for the same prompt and fixture', async () => {
    const provider = new MockLlmProvider(mockConfig(), [
      { id: 'vote', output: { decision: 'upvote' } },
    ]);

    const first = await provider.generateStructured({
      prompt: votePrompt,
      schema: voteSchema,
    });
    const second = await provider.generateStructured({
      prompt: votePrompt,
      schema: voteSchema,
    });

    expect(second).toEqual(first);
  });

  it('parses native JSON output when structured output is json-object', async () => {
    const provider = new MockLlmProvider(
      mockConfig({ LLM_STRUCTURED_OUTPUT: 'json-object' }),
      [{ id: 'vote', output: { decision: 'downvote' } }],
    );

    const result = await provider.generateStructured({
      prompt: votePrompt,
      schema: voteSchema,
    });

    expect(result.output).toEqual({ decision: 'downvote' });
    expect(result.telemetry).toMatchObject({
      source: 'mock',
      model: 'fixture-model',
    });
  });

  it('parses fenced JSON when structured output is text-json-fallback', async () => {
    const provider = new MockLlmProvider(
      mockConfig({ LLM_STRUCTURED_OUTPUT: 'text-json-fallback' }),
      [{ id: 'vote', output: { decision: 'skip' } }],
    );

    const result = await provider.generateStructured({
      prompt: votePrompt,
      schema: voteSchema,
    });

    expect(result.output).toEqual({ decision: 'skip' });
  });

  it('rejects structured requests when structured output is unsupported', async () => {
    const provider = new MockLlmProvider(
      mockConfig({ LLM_STRUCTURED_OUTPUT: 'unsupported' }),
      [{ id: 'vote', output: { decision: 'upvote' } }],
    );

    await expect(
      provider.generateStructured({ prompt: votePrompt, schema: voteSchema }),
    ).rejects.toBeInstanceOf(ProviderCapabilityError);
  });

  it('reports fixture tokens when usage metadata is required', async () => {
    const provider = new MockLlmProvider(
      mockConfig({ LLM_USAGE_METADATA: 'required' }),
      [
        {
          id: 'vote',
          output: { decision: 'upvote' },
          tokens: { prompt: 12, completion: 4 },
        },
      ],
    );

    const result = await provider.generateStructured({
      prompt: votePrompt,
      schema: voteSchema,
    });

    expect(result.telemetry.tokens).toEqual({
      prompt: 12,
      completion: 4,
      total: 16,
    });
  });

  it('omits tokens when usage metadata is unavailable', async () => {
    const provider = new MockLlmProvider(
      mockConfig({ LLM_USAGE_METADATA: 'unavailable' }),
      [{ id: 'vote', output: { decision: 'upvote' } }],
    );

    const result = await provider.generateStructured({
      prompt: votePrompt,
      schema: voteSchema,
    });

    expect(result.telemetry.tokens).toBeUndefined();
  });

  it('estimates tokens deterministically when the fixture provides none', async () => {
    const provider = new MockLlmProvider(mockConfig(), [
      { id: 'vote', output: { decision: 'upvote' } },
    ]);

    const first = await provider.generateStructured({
      prompt: votePrompt,
      schema: voteSchema,
    });
    const second = await provider.generateStructured({
      prompt: votePrompt,
      schema: voteSchema,
    });

    expect(first.telemetry.tokens?.prompt).toBeGreaterThan(0);
    expect(first.telemetry.tokens?.completion).toBeGreaterThan(0);
    expect(second.telemetry.tokens).toEqual(first.telemetry.tokens);
  });

  it('simulates a configured provider failure', async () => {
    const provider = new MockLlmProvider(mockConfig(), [
      {
        id: 'vote',
        failure: { code: 'TIMEOUT', message: 'Mock timeout', retryable: true },
      },
    ]);

    await expect(
      provider.generateStructured({ prompt: votePrompt, schema: voteSchema }),
    ).rejects.toMatchObject({
      code: 'TIMEOUT',
      message: 'Mock timeout',
      retryable: true,
    });
  });

  it('fails with UNKNOWN when no fixture matches the prompt', async () => {
    const provider = new MockLlmProvider(mockConfig(), [
      { id: 'comment', output: { content: 'Agreed.' } },
    ]);

    await expect(
      provider.generateStructured({ prompt: votePrompt, schema: voteSchema }),
    ).rejects.toMatchObject({ code: 'UNKNOWN', retryable: false });
  });

  it('does not match a fixture id inside another word', async () => {
    const provider = new MockLlmProvider(mockConfig(), [
      { id: 'vote', output: { decision: 'upvote' } },
    ]);
    const prompt = {
      system: 'Simulate an action for the current World.',
      user: 'The thread is about the power of an upvote.',
    };

    await expect(
      provider.generateStructured({ prompt, schema: voteSchema }),
    ).rejects.toMatchObject({ code: 'UNKNOWN' });
  });

  it('treats schema-invalid fixture output as a malformed response', async () => {
    const provider = new MockLlmProvider(mockConfig(), [
      { id: 'vote', output: { decision: 'bogus' } },
    ]);

    await expect(
      provider.generateStructured({ prompt: votePrompt, schema: voteSchema }),
    ).rejects.toBeInstanceOf(ProviderMalformedResponseError);
  });

  it('honors fixture latency and a fixed default latency otherwise', async () => {
    const provider = new MockLlmProvider(mockConfig(), [
      { id: 'vote', output: { decision: 'upvote' }, latencyMs: 12 },
      { id: 'comment', output: { content: 'Agreed.' }, latencyMs: 12 },
    ]);
    const fastProvider = new MockLlmProvider(mockConfig(), [
      { id: 'vote', output: { decision: 'upvote' } },
    ]);

    const result = await provider.generateStructured({
      prompt: votePrompt,
      schema: voteSchema,
    });
    const fastResult = await fastProvider.generateStructured({
      prompt: votePrompt,
      schema: voteSchema,
    });

    expect(result.telemetry.latencyMs).toBe(12);
    expect(fastResult.telemetry.latencyMs).toBe(7);
  });
});
