import { z } from 'zod';

import {
  OpenAiCompatibleChatCompletion,
  parseStructuredAssistantContent,
  parseStructuredTextContent,
} from '@/lib/llm/openai-compatible-contract';
import { StructuredOutputMode } from '@/lib/llm/provider-config';

/** Shared response normalization: json-object parses natively, while
 * text-json-fallback extracts JSON from prose. */
export function parseStructuredOutputByMode<T>(
  mode: StructuredOutputMode,
  completion: OpenAiCompatibleChatCompletion,
  assistantContent: string,
  schema: z.ZodType<T>,
): T {
  return mode === 'json-object'
    ? parseStructuredAssistantContent(completion, schema)
    : parseStructuredTextContent(assistantContent, schema);
}
