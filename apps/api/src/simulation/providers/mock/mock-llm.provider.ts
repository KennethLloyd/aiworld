import {
  extractAssistantContent,
  parseOpenAiCompatibleChatCompletion,
  parseStructuredAssistantContent,
  parseStructuredTextContent,
} from '@/lib/llm/openai-compatible-contract';
import { ProviderConfig } from '@/lib/llm/provider-config';
import {
  ProviderCapabilityError,
  ProviderError,
  ProviderErrorCode,
} from '@/lib/llm/provider-error';
import {
  LlmProvider,
  LlmProviderPrompt,
  LlmProviderRequest,
  LlmProviderResult,
  LlmProviderTokenUsage,
} from '@/simulation/providers/llm-provider.port';

const DEFAULT_LATENCY_MS = 7;
const CHARS_PER_TOKEN = 4;

export type MockLlmFailure = {
  code: ProviderErrorCode;
  message: string;
  retryable: boolean;
};

export type MockLlmFixture = {
  id: string;
  output?: unknown;
  failure?: MockLlmFailure;
  latencyMs?: number;
  tokens?: { prompt: number; completion: number };
};

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / CHARS_PER_TOKEN));
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export class MockLlmProvider extends LlmProvider {
  constructor(
    readonly config: ProviderConfig,
    private readonly fixtures: readonly MockLlmFixture[],
  ) {
    super();
  }

  async generateStructured<T>(
    request: LlmProviderRequest<T>,
  ): Promise<LlmProviderResult<T>> {
    // text-json-fallback still returns JSON through the text parser, so only
    // unsupported rejects the request.
    if (this.config.capabilities.structuredOutput === 'unsupported') {
      throw new ProviderCapabilityError(
        'Provider does not support structured output',
      );
    }

    const fixture = this.selectFixture(request.prompt);
    if (fixture === undefined) {
      throw new ProviderError(
        'UNKNOWN',
        'No mock fixture matched the prompt',
        false,
      );
    }

    if (fixture.failure) {
      throw new ProviderError(
        fixture.failure.code,
        fixture.failure.message,
        fixture.failure.retryable,
      );
    }

    if (fixture.output === undefined) {
      throw new ProviderError('UNKNOWN', 'Mock fixture has no output', false);
    }

    const outputJson = JSON.stringify(fixture.output);
    const useTextFallback =
      this.config.capabilities.structuredOutput === 'text-json-fallback';
    const content = useTextFallback
      ? `\`\`\`json\n${outputJson}\n\`\`\``
      : outputJson;
    const tokens = this.buildTokenUsage(request.prompt, fixture, outputJson);

    const completion = parseOpenAiCompatibleChatCompletion({
      id: `mock-${fixture.id}`,
      object: 'chat.completion',
      model: this.config.model,
      choices: [
        {
          index: 0,
          message: { role: 'assistant', content },
          finish_reason: 'stop',
        },
      ],
      usage:
        tokens === undefined
          ? undefined
          : {
              prompt_tokens: tokens.prompt,
              completion_tokens: tokens.completion,
              total_tokens: tokens.total,
            },
    });

    const assistantContent = extractAssistantContent(completion);
    const output = useTextFallback
      ? parseStructuredTextContent(assistantContent, request.schema)
      : parseStructuredAssistantContent(completion, request.schema);

    return {
      output,
      telemetry: {
        source: this.config.providerId,
        model: this.config.model,
        latencyMs: fixture.latencyMs ?? DEFAULT_LATENCY_MS,
        tokens,
      },
    };
  }

  private selectFixture(prompt: LlmProviderPrompt): MockLlmFixture | undefined {
    // The prompt text selects the fixture by its id as a whole word.
    // Same prompt, same result.
    const promptText = `${prompt.system}\n${prompt.user}`.toLocaleLowerCase();
    return this.fixtures.find((fixture) => {
      const pattern = new RegExp(
        `\\b${escapeRegExp(fixture.id.toLocaleLowerCase())}\\b`,
      );
      return pattern.test(promptText);
    });
  }

  private buildTokenUsage(
    prompt: LlmProviderPrompt,
    fixture: MockLlmFixture,
    outputJson: string,
  ): LlmProviderTokenUsage | undefined {
    if (this.config.capabilities.usageMetadata === 'unavailable') {
      return undefined;
    }

    const promptTokens =
      fixture.tokens?.prompt ??
      estimateTokens(`${prompt.system}\n${prompt.user}`);
    const completionTokens =
      fixture.tokens?.completion ?? estimateTokens(outputJson);

    return {
      prompt: promptTokens,
      completion: completionTokens,
      total: promptTokens + completionTokens,
    };
  }
}
