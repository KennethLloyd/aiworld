import {
  extractAssistantContent,
  openAiCompatibleChatRequestSchema,
  parseOpenAiCompatibleChatCompletion,
  type OpenAiCompatibleChatRequest,
} from '@/lib/llm/openai-compatible-contract';
import {
  assertStructuredOutputEnabled,
  ProviderConfig,
} from '@/lib/llm/provider-config';
import { mapProviderError } from '@/lib/llm/provider-error';
import { parseStructuredOutputByMode } from '@/simulation/providers/llm-provider.output';
import {
  LlmProvider,
  LlmProviderRequest,
  LlmProviderResult,
  LlmProviderTokenUsage,
} from '@/simulation/providers/llm-provider.port';

/** The narrow slice of the fetch response the adapter reads. */
export type ProviderFetchResponse = {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
};

export type FetchLike = (
  url: string,
  init?: RequestInit,
) => Promise<ProviderFetchResponse>;

/** OpenAI-compatible endpoint adapter. Vendor code stays
 * in this one adapter; capabilities come from config and credentials never
 * leak into telemetry, results, or mapped errors. */
export class OpenAiCompatibleLlmProvider extends LlmProvider {
  constructor(
    readonly config: ProviderConfig,
    private readonly fetchImpl: FetchLike = globalThis.fetch,
  ) {
    super();
  }

  async generateStructured<T>(
    request: LlmProviderRequest<T>,
  ): Promise<LlmProviderResult<T>> {
    // Capability gate: rejects unsupported and the unverified json-schema
    // mode; the remaining modes map to an explicit request below.
    assertStructuredOutputEnabled(this.config);

    const chatRequest = openAiCompatibleChatRequestSchema.parse(
      this.buildChatRequest(request),
    );

    const startedAt = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await this.fetchImpl(
        `${this.config.baseUrl}/chat/completions`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(chatRequest),
          signal: controller.signal,
        },
      );

      if (!response.ok) {
        // Ignore the error body so provider content or echoed credentials
        // never reach domain errors.
        throw Object.assign(new Error('Provider request failed'), {
          statusCode: response.status,
        });
      }

      const completion = parseOpenAiCompatibleChatCompletion(
        await response.json(),
      );
      const latencyMs = Date.now() - startedAt;
      const assistantContent = extractAssistantContent(completion);
      const output = parseStructuredOutputByMode(
        this.config.capabilities.structuredOutput,
        completion,
        assistantContent,
        request.schema,
      );

      return {
        output,
        telemetry: {
          source: this.config.providerId,
          model: completion.model,
          latencyMs,
          tokens: this.buildTokenUsage(completion),
        },
      };
    } catch (error) {
      throw mapProviderError(error);
    } finally {
      clearTimeout(timeout);
    }
  }

  private buildChatRequest<T>(
    request: LlmProviderRequest<T>,
  ): OpenAiCompatibleChatRequest {
    const messages: OpenAiCompatibleChatRequest['messages'] = [
      { role: 'system', content: request.prompt.system },
      { role: 'user', content: request.prompt.user },
    ];

    return {
      model: this.config.model,
      messages,
      ...(request.temperature === undefined
        ? {}
        : { temperature: request.temperature }),
      ...this.responseFormat(),
    };
  }

  /** json-object asks for native JSON; text-json-fallback sends no
   * response_format and relies on the shared text-to-JSON parser. */
  private responseFormat(): Pick<
    OpenAiCompatibleChatRequest,
    'response_format'
  > {
    if (this.config.capabilities.structuredOutput === 'json-object') {
      return { response_format: { type: 'json_object' } };
    }
    return {};
  }

  /** Reports usage tokens when present and usage metadata is not
   * `unavailable`. */
  private buildTokenUsage(
    completion: ReturnType<typeof parseOpenAiCompatibleChatCompletion>,
  ): LlmProviderTokenUsage | undefined {
    if (this.config.capabilities.usageMetadata === 'unavailable') {
      return undefined;
    }

    const usage = completion.usage;
    if (
      usage === undefined ||
      usage.prompt_tokens === undefined ||
      usage.completion_tokens === undefined ||
      usage.total_tokens === undefined
    ) {
      return undefined;
    }

    return {
      prompt: usage.prompt_tokens,
      completion: usage.completion_tokens,
      total: usage.total_tokens,
    };
  }
}
