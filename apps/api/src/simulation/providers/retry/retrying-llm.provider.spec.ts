import { z } from 'zod';

import { loadProviderConfig } from '@/lib/llm/provider-config';
import {
  ProviderCapabilityError,
  ProviderError,
  ProviderMalformedResponseError,
} from '@/lib/llm/provider-error';
import {
  LlmProvider,
  LlmProviderRequest,
  LlmProviderResult,
} from '@/simulation/providers/llm-provider.port';

import { RetryingLlmProvider, RetryClock } from './retrying-llm.provider';

const schema = z.object({ ok: z.literal(true) });
const request: LlmProviderRequest<{ ok: true }> = {
  prompt: { system: 'Return {"ok":true}.', user: 'Health check.' },
  schema,
};

function config(overrides: Record<string, string> = {}) {
  return loadProviderConfig({
    LLM_PROVIDER: 'mock',
    LLM_MAX_RETRIES: '2',
    LLM_RETRY_BASE_DELAY_MS: '100',
    LLM_RETRY_MAX_DELAY_MS: '400',
    LLM_RETRY_JITTER_RATIO: '0.25',
    ...overrides,
  });
}

function successResult(): LlmProviderResult<{ ok: true }> {
  return {
    output: { ok: true },
    telemetry: {
      source: 'mock',
      model: 'mock',
      latencyMs: 7,
      tokens: { prompt: 1, completion: 1, total: 2 },
    },
  };
}

function stubProvider(generateStructured: jest.Mock): jest.Mocked<LlmProvider> {
  return {
    config: config(),
    generateStructured,
  } as unknown as jest.Mocked<LlmProvider>;
}

function createClock() {
  const sleeps: number[] = [];
  const sleep = jest.fn(async (ms: number) => {
    sleeps.push(ms);
  });
  const random = jest.fn(() => 0.5);
  return { sleeps, sleep, random } as unknown as RetryClock & {
    sleeps: number[];
  };
}

describe('RetryingLlmProvider', () => {
  it('returns the inner result on success without retrying', async () => {
    const inner = stubProvider(jest.fn().mockResolvedValue(successResult()));
    const clock = createClock();
    const provider = new RetryingLlmProvider(config(), inner, clock);

    const result = await provider.generateStructured(request);

    expect(result).toEqual(successResult());
    expect(inner.generateStructured).toHaveBeenCalledTimes(1);
    expect(clock.sleep).not.toHaveBeenCalled();
  });

  it('retries transient failures up to the configured retry budget', async () => {
    const inner = stubProvider(
      jest
        .fn()
        .mockRejectedValueOnce(
          new ProviderError('RATE_LIMIT', 'slow down', true, 429),
        )
        .mockRejectedValueOnce(
          new ProviderError('RATE_LIMIT', 'slow down', true, 429),
        )
        .mockResolvedValue(successResult()),
    );
    const clock = createClock();
    const provider = new RetryingLlmProvider(config(), inner, clock);

    const result = await provider.generateStructured(request);

    expect(result).toEqual(successResult());
    expect(inner.generateStructured).toHaveBeenCalledTimes(3);
    expect(clock.sleep).toHaveBeenCalledTimes(2);
  });

  it('stops retrying after the budget and throws the mapped error', async () => {
    const inner = stubProvider(
      jest
        .fn()
        .mockRejectedValue(
          new ProviderError('RATE_LIMIT', 'slow down', true, 429),
        ),
    );
    const clock = createClock();
    const provider = new RetryingLlmProvider(config(), inner, clock);

    await expect(provider.generateStructured(request)).rejects.toMatchObject({
      code: 'RATE_LIMIT',
      retryable: true,
      statusCode: 429,
    });
    expect(inner.generateStructured).toHaveBeenCalledTimes(3);
    expect(clock.sleep).toHaveBeenCalledTimes(2);
  });

  it.each([
    [
      'AUTHENTICATION',
      new ProviderError('AUTHENTICATION', 'denied', false, 401),
    ],
    ['MALFORMED_RESPONSE', new ProviderMalformedResponseError('bad payload')],
    ['CAPABILITY', new ProviderCapabilityError('unsupported')],
    ['UNKNOWN', new ProviderError('UNKNOWN', 'mystery', false)],
  ] as const)(
    'does not retry the permanent %s failure',
    async (_code, error) => {
      const inner = stubProvider(jest.fn().mockRejectedValue(error));
      const clock = createClock();
      const provider = new RetryingLlmProvider(config(), inner, clock);

      await expect(provider.generateStructured(request)).rejects.toBe(error);
      expect(inner.generateStructured).toHaveBeenCalledTimes(1);
      expect(clock.sleep).not.toHaveBeenCalled();
    },
  );

  it('applies bounded exponential backoff with jitter', async () => {
    const inner = stubProvider(
      jest
        .fn()
        .mockRejectedValue(
          new ProviderError('TIMEOUT', 'timed out', true, 408),
        ),
    );
    const clock = createClock();
    const provider = new RetryingLlmProvider(config(), inner, clock);

    await expect(provider.generateStructured(request)).rejects.toMatchObject({
      code: 'TIMEOUT',
    });

    // random() = 0.5 makes the jitter factor 1, so delays are the raw
    // exponential values: 100ms then 200ms.
    expect(clock.sleeps).toEqual([100, 200]);
  });

  it('caps the backoff at the maximum delay', async () => {
    const inner = stubProvider(
      jest
        .fn()
        .mockRejectedValue(
          new ProviderError('NETWORK', 'unavailable', true, 503),
        ),
    );
    const clock = createClock();
    const provider = new RetryingLlmProvider(
      config({
        LLM_MAX_RETRIES: '3',
        LLM_RETRY_BASE_DELAY_MS: '100',
        LLM_RETRY_MAX_DELAY_MS: '150',
      }),
      inner,
      clock,
    );

    await expect(provider.generateStructured(request)).rejects.toMatchObject({
      code: 'NETWORK',
    });

    // 100, then 200 capped to 150, then 400 capped to 150.
    expect(clock.sleeps).toEqual([100, 150, 150]);
  });

  it('keeps the ceiling a hard bound even at maximum jitter', async () => {
    const inner = stubProvider(
      jest
        .fn()
        .mockRejectedValue(
          new ProviderError('NETWORK', 'unavailable', true, 503),
        ),
    );
    const clock = createClock();
    clock.random = jest.fn(() => 1);
    const provider = new RetryingLlmProvider(
      config({
        LLM_MAX_RETRIES: '1',
        LLM_RETRY_BASE_DELAY_MS: '100',
        LLM_RETRY_MAX_DELAY_MS: '120',
      }),
      inner,
      clock,
    );

    await expect(provider.generateStructured(request)).rejects.toMatchObject({
      code: 'NETWORK',
    });

    // 100 * 1.25 = 125, clamped to the 120ms ceiling.
    expect(clock.sleeps).toEqual([120]);
  });

  it('honors a server Retry-After value over the computed backoff', async () => {
    const inner = stubProvider(
      jest
        .fn()
        .mockRejectedValue(
          new ProviderError('RATE_LIMIT', 'slow down', true, 429, 5000),
        ),
    );
    const clock = createClock();
    const provider = new RetryingLlmProvider(config(), inner, clock);

    await expect(provider.generateStructured(request)).rejects.toMatchObject({
      code: 'RATE_LIMIT',
    });

    expect(clock.sleeps).toEqual([5000, 5000]);
  });

  it('does not retry when the retry budget is zero', async () => {
    const inner = stubProvider(
      jest
        .fn()
        .mockRejectedValue(
          new ProviderError('TIMEOUT', 'timed out', true, 408),
        ),
    );
    const clock = createClock();
    const provider = new RetryingLlmProvider(
      config({ LLM_MAX_RETRIES: '0' }),
      inner,
      clock,
    );

    await expect(provider.generateStructured(request)).rejects.toMatchObject({
      code: 'TIMEOUT',
    });
    expect(inner.generateStructured).toHaveBeenCalledTimes(1);
    expect(clock.sleep).not.toHaveBeenCalled();
  });
});
