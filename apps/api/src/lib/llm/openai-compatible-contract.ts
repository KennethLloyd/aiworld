import { z } from 'zod';

import { ProviderMalformedResponseError } from './provider-error.js';

export const openAiCompatibleMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant', 'tool']),
  content: z.union([z.string(), z.array(z.unknown()), z.null()]),
  name: z.string().optional(),
  tool_call_id: z.string().optional(),
});

export const openAiCompatibleChatRequestSchema = z.object({
  model: z.string().min(1),
  messages: z.array(openAiCompatibleMessageSchema).min(1),
  temperature: z.number().min(0).max(2).optional(),
  max_tokens: z.number().int().positive().optional(),
  response_format: z
    .object({
      type: z.enum(['text', 'json_object', 'json_schema']),
      json_schema: z.record(z.string(), z.unknown()).optional(),
    })
    .optional(),
});

const usageSchema = z
  .object({
    prompt_tokens: z.number().int().nonnegative().optional(),
    completion_tokens: z.number().int().nonnegative().optional(),
    total_tokens: z.number().int().nonnegative().optional(),
  })
  .passthrough();

export const openAiCompatibleChatCompletionSchema = z
  .object({
    id: z.string().min(1),
    object: z.literal('chat.completion'),
    created: z.number().int().nonnegative().optional(),
    model: z.string().min(1),
    choices: z
      .array(
        z.object({
          index: z.number().int().nonnegative(),
          message: z.object({
            role: z.literal('assistant'),
            content: z.union([z.string(), z.null()]),
          }),
          finish_reason: z.string().nullable().optional(),
        }),
      )
      .min(1),
    usage: usageSchema.optional(),
  })
  .passthrough();

export type OpenAiCompatibleChatRequest = z.infer<
  typeof openAiCompatibleChatRequestSchema
>;
export type OpenAiCompatibleChatCompletion = z.infer<
  typeof openAiCompatibleChatCompletionSchema
>;

export function parseOpenAiCompatibleChatCompletion(
  value: unknown,
): OpenAiCompatibleChatCompletion {
  const parsed = openAiCompatibleChatCompletionSchema.safeParse(value);
  if (!parsed.success) {
    throw new ProviderMalformedResponseError(
      'OpenAI-compatible response did not match the contract',
    );
  }

  return parsed.data;
}

export function extractAssistantContent(
  response: OpenAiCompatibleChatCompletion,
): string {
  // Actions consume this validated message content, not the provider envelope.
  const content = response.choices[0]?.message.content;
  if (typeof content !== 'string' || content.trim().length === 0) {
    throw new ProviderMalformedResponseError(
      'OpenAI-compatible response contained no assistant content',
    );
  }

  return content;
}

export function parseStructuredAssistantContent<T>(
  response: OpenAiCompatibleChatCompletion,
  schema: z.ZodType<T>,
): T {
  return parseStructuredJsonContent(extractAssistantContent(response), schema);
}

function parseStructuredJsonContent<T>(
  content: string,
  schema: z.ZodType<T>,
): T {
  let json: unknown;

  try {
    json = JSON.parse(content) as unknown;
  } catch {
    throw new ProviderMalformedResponseError(
      'Assistant content was not valid JSON',
    );
  }

  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    throw new ProviderMalformedResponseError(
      'Assistant JSON did not match the requested schema',
    );
  }

  return parsed.data;
}

export function extractStructuredJsonText(content: string): string {
  const trimmed = content.trim();
  const fenced = trimmed.match(/```[^\n]*\n?([\s\S]*?)```/);
  const candidate = (fenced?.[1] ?? trimmed).trim();
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');

  if (start === -1 || end === -1 || end <= start) {
    return '';
  }

  return candidate.slice(start, end + 1);
}

export function parseStructuredTextContent<T>(
  content: string,
  schema: z.ZodType<T>,
): T {
  return parseStructuredJsonContent(extractStructuredJsonText(content), schema);
}
