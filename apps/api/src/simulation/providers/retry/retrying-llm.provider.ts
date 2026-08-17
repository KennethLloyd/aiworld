import { ProviderConfig } from '@/lib/llm/provider-config';
import { mapProviderError, ProviderError } from '@/lib/llm/provider-error';
import {
  LlmProvider,
  LlmProviderRequest,
  LlmProviderResult,
} from '@/simulation/providers/llm-provider.port';

/** Injectable clock so tests can record delays and fix the jitter. */
export type RetryClock = {
  sleep: (ms: number) => Promise<void>;
  random: () => number;
};

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Retries transient provider failures with bounded exponential backoff and
 * jitter, honoring a server Retry-After value when present. */
export class RetryingLlmProvider extends LlmProvider {
  constructor(
    readonly config: ProviderConfig,
    readonly inner: LlmProvider,
    private readonly clock: RetryClock = {
      sleep: defaultSleep,
      random: Math.random,
    },
  ) {
    super();
  }

  async generateStructured<T>(
    request: LlmProviderRequest<T>,
  ): Promise<LlmProviderResult<T>> {
    let attempt = 0;
    for (;;) {
      try {
        return await this.inner.generateStructured(request);
      } catch (error) {
        const providerError = mapProviderError(error);
        if (!providerError.retryable || attempt >= this.config.maxRetries) {
          throw providerError;
        }
        await this.clock.sleep(this.backoffDelay(attempt, providerError));
        attempt += 1;
      }
    }
  }

  private backoffDelay(attempt: number, error: ProviderError): number {
    if (error.retryAfterMs !== undefined) {
      return error.retryAfterMs;
    }
    const exponential = this.config.retry.baseDelayMs * 2 ** attempt;
    const capped = Math.min(exponential, this.config.retry.maxDelayMs);
    const jitterFactor =
      1 + this.config.retry.jitterRatio * (this.clock.random() * 2 - 1);
    // Clamp so the ceiling is a hard bound even with jitter.
    return Math.round(
      Math.min(capped * jitterFactor, this.config.retry.maxDelayMs),
    );
  }
}
