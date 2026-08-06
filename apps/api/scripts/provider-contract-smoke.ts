import { z } from 'zod';

import {
  extractAssistantContent,
  openAiCompatibleChatRequestSchema,
  parseOpenAiCompatibleChatCompletion,
  parseStructuredAssistantContent,
} from '../src/lib/llm/openai-compatible-contract.js';
import { loadProviderConfig } from '../src/lib/llm/provider-config.js';
import { mapProviderError } from '../src/lib/llm/provider-error.js';

async function main(): Promise<void> {
  const config = loadProviderConfig();

  if (
    config.providerId === 'mock' ||
    config.baseUrl === undefined ||
    config.apiKey === undefined
  ) {
    throw new Error(
      'Live provider smoke test requires LLM_PROVIDER, LLM_BASE_URL, LLM_API_KEY, and LLM_MODEL',
    );
  }

  const request = openAiCompatibleChatRequestSchema.parse({
    model: config.model,
    messages: [
      {
        role: 'system',
        content: 'Return only valid JSON with the exact shape {"ok":true}.',
      },
      {
        role: 'user',
        content: 'Respond with the requested health-check object.',
      },
    ],
    temperature: 0,
    response_format: { type: 'json_object' },
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
      signal: controller.signal,
    });

    if (!response.ok) {
      const error = Object.assign(new Error('Provider request failed'), {
        statusCode: response.status,
      });
      throw mapProviderError(error);
    }

    const completion = parseOpenAiCompatibleChatCompletion(
      await response.json(),
    );
    const structured = parseStructuredAssistantContent(
      completion,
      z.object({ ok: z.literal(true) }),
    );

    console.log(
      JSON.stringify({
        providerId: config.providerId,
        model: completion.model,
        object: completion.object,
        assistantContent: extractAssistantContent(completion),
        structured,
        usage: completion.usage,
      }),
    );
  } catch (error) {
    const mapped = mapProviderError(error);
    console.error(
      JSON.stringify({
        code: mapped.code,
        retryable: mapped.retryable,
        statusCode: mapped.statusCode,
      }),
    );
    process.exitCode = 1;
  } finally {
    clearTimeout(timeout);
  }
}

void main();
