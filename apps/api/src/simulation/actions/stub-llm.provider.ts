import { ProviderConfig } from '@/lib/llm/provider-config';
import {
  LlmProvider,
  LlmProviderPrompt,
  LlmProviderRequest,
  LlmProviderResult,
} from '@/simulation/providers/llm-provider.port';

/** A scripted provider that records the requests it receives and returns a
 * fixed output, so specs can assert on the composed prompts. */
export class StubLlmProvider extends LlmProvider {
  requests: LlmProviderRequest<unknown>[] = [];

  constructor(
    readonly config: ProviderConfig,
    private readonly output: unknown,
  ) {
    super();
  }

  async generateStructured<T>(
    request: LlmProviderRequest<T>,
  ): Promise<LlmProviderResult<T>> {
    this.requests.push(request);
    return {
      output: this.output as T,
      telemetry: {
        source: 'mock',
        model: 'fixture-model',
        latencyMs: 1,
        tokens: { prompt: 1, completion: 1, total: 2 },
      },
    };
  }

  lastPrompt(): LlmProviderPrompt {
    const request = this.requests.at(-1);
    if (!request) {
      throw new Error('No provider request recorded');
    }
    return request.prompt;
  }
}
