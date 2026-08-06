import { z } from 'zod';

import {
  openAiCompatibleCompletionFixture,
  openAiCompatibleRequestFixture,
} from './fixtures/openai-compatible-fixtures.js';
import {
  extractAssistantContent,
  openAiCompatibleChatCompletionSchema,
  openAiCompatibleChatRequestSchema,
  parseOpenAiCompatibleChatCompletion,
  parseStructuredAssistantContent,
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
