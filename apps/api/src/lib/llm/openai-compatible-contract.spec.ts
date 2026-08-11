import { z } from 'zod';

import {
  openAiCompatibleCompletionFixture,
  openAiCompatibleRequestFixture,
} from './fixtures/openai-compatible-fixtures.js';
import {
  extractAssistantContent,
  extractStructuredJsonText,
  openAiCompatibleChatCompletionSchema,
  openAiCompatibleChatRequestSchema,
  parseOpenAiCompatibleChatCompletion,
  parseStructuredAssistantContent,
  parseStructuredTextContent,
} from './openai-compatible-contract.js';
import { ProviderMalformedResponseError } from './provider-error.js';

describe('OpenAI-compatible provider contract', () => {
  it('parses the sanitized request fixture', () => {
    expect(
      openAiCompatibleChatRequestSchema.parse(openAiCompatibleRequestFixture),
    ).toEqual(openAiCompatibleRequestFixture);
  });

  it('parses provider usage extensions without losing standard usage fields', () => {
    const response = parseOpenAiCompatibleChatCompletion(
      openAiCompatibleCompletionFixture,
    );

    expect(response.usage).toMatchObject({
      prompt_tokens: 124,
      completion_tokens: 51,
      total_tokens: 175,
    });
    expect(response.usage?.completion_tokens_details).toEqual({
      reasoning_tokens: 45,
    });
  });

  it('extracts native JSON-object output through the same safe parser used for fallback text JSON', () => {
    const response = parseOpenAiCompatibleChatCompletion(
      openAiCompatibleCompletionFixture,
    );

    expect(
      parseStructuredAssistantContent(
        response,
        z.object({ ok: z.literal(true) }),
      ),
    ).toEqual({ ok: true });
  });

  it('rejects malformed provider responses without retaining raw content', () => {
    expect(() =>
      parseOpenAiCompatibleChatCompletion({
        ...openAiCompatibleCompletionFixture,
        choices: [],
        secret: 'should-not-appear-in-error',
      }),
    ).toThrow(ProviderMalformedResponseError);

    expect(() =>
      parseStructuredAssistantContent(
        parseOpenAiCompatibleChatCompletion(openAiCompatibleCompletionFixture),
        z.object({ expected: z.string() }),
      ),
    ).toThrow('Assistant JSON did not match the requested schema');
  });

  it('rejects an empty assistant response', () => {
    const response = openAiCompatibleChatCompletionSchema.parse({
      ...openAiCompatibleCompletionFixture,
      choices: [
        {
          ...openAiCompatibleCompletionFixture.choices[0],
          message: { role: 'assistant', content: null },
        },
      ],
    });

    expect(() => extractAssistantContent(response)).toThrow(
      ProviderMalformedResponseError,
    );
  });
});

describe('text-to-JSON fallback extraction', () => {
  it('extracts JSON from a markdown code fence with a json tag', () => {
    const text = '```json\n{"decision":"upvote"}\n```';

    expect(extractStructuredJsonText(text)).toBe('{"decision":"upvote"}');
  });

  it('extracts JSON from a code fence without a tag', () => {
    const text = '```\n{"decision":"downvote"}\n```';

    expect(extractStructuredJsonText(text)).toBe('{"decision":"downvote"}');
  });

  it('extracts JSON from a code fence that appears after prose', () => {
    const text = 'Here is the result:\n```json\n{"decision":"skip"}\n```';

    expect(extractStructuredJsonText(text)).toBe('{"decision":"skip"}');
  });

  it('extracts JSON from prose without a fence', () => {
    const text = 'The decision is {"decision":"upvote"} for this post.';

    expect(extractStructuredJsonText(text)).toBe('{"decision":"upvote"}');
  });

  it('keeps nested braces inside the extracted object', () => {
    const json = '{"vote":{"value":"upvote","count":2}}';
    const text = `Result: ${json} thanks`;

    expect(extractStructuredJsonText(text)).toBe(json);
  });

  it('returns an empty string when the text has no JSON object', () => {
    expect(extractStructuredJsonText('No JSON here.')).toBe('');
  });

  it('parses fenced JSON and validates it against the schema', () => {
    const schema = z.object({
      decision: z.enum(['upvote', 'downvote', 'skip']),
    });

    expect(
      parseStructuredTextContent('```json\n{"decision":"upvote"}\n```', schema),
    ).toEqual({ decision: 'upvote' });
  });

  it('rejects text without JSON as a malformed response', () => {
    expect(() =>
      parseStructuredTextContent(
        'I cannot respond.',
        z.object({ ok: z.boolean() }),
      ),
    ).toThrow(ProviderMalformedResponseError);
  });

  it('rejects JSON that does not match the schema', () => {
    expect(() =>
      parseStructuredTextContent(
        '{"decision":"bogus"}',
        z.object({ ok: z.boolean() }),
      ),
    ).toThrow('Assistant JSON did not match the requested schema');
  });
});
