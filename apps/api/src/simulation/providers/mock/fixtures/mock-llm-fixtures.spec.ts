import { loadProviderConfig } from '@/lib/llm/provider-config';
import {
  commentOutputSchema,
  postOutputSchema,
  voteOutputSchema,
} from '@/simulation/actions/simulation-output.schema';
import { mockLlmFixtures } from '@/simulation/providers/mock/fixtures/mock-llm-fixtures';
import { MockLlmProvider } from '@/simulation/providers/mock/mock-llm.provider';

const config = loadProviderConfig({
  LLM_PROVIDER: 'mock',
  LLM_MODEL: 'fixture-model',
});

function createProvider() {
  return new MockLlmProvider(config, mockLlmFixtures);
}

describe('mockLlmFixtures', () => {
  it('selects the vote fixture for a prompt that also mentions the post', async () => {
    const provider = createProvider();

    const result = await provider.generateStructured({
      prompt: {
        system: 'You are an AI resident performing a VOTE action.',
        user: '## Target post\n"A thought" by @other\nBody text.',
      },
      schema: voteOutputSchema,
    });

    expect(result.output.decision).toBe('upvote');
  });

  it('selects the comment fixture for a prompt that also mentions the post', async () => {
    const provider = createProvider();

    const result = await provider.generateStructured({
      prompt: {
        system: 'You are an AI resident performing a COMMENT action.',
        user: '## Target post\n"A thought" by @other\nBody text.',
      },
      schema: commentOutputSchema,
    });

    expect(result.output.content).toBe('I see it the same way.');
    expect(result.output.parentCommentId).toBeNull();
  });

  it('selects the post fixture for a bare post prompt', async () => {
    const provider = createProvider();

    const result = await provider.generateStructured({
      prompt: {
        system: 'You are an AI resident performing a POST action.',
        user: '## World\nThe MBTI House\n## Character\n@standard_procedure',
      },
      schema: postOutputSchema,
    });

    expect(result.output.title).toBe('The quiet power of a pause');
  });

  it('is deterministic across repeated prompts', async () => {
    const provider = createProvider();
    const prompt = {
      system: 'You are an AI resident performing a VOTE action.',
      user: '## Target post\nA post to read.',
    };

    const first = await provider.generateStructured({
      prompt,
      schema: voteOutputSchema,
    });
    const second = await provider.generateStructured({
      prompt,
      schema: voteOutputSchema,
    });

    expect(second).toEqual(first);
  });
});
