import { composeActionPrompt } from './action-prompt';

describe('composeActionPrompt', () => {
  it('splits standing instructions and context into system and user prompts', () => {
    const prompt = composeActionPrompt({
      action: 'VOTE',
      instructions: 'Decide how this character votes.',
      outputFormat: '{"decision": "upvote" | "downvote" | "skip"}',
      contextSections: [
        { heading: 'World', body: 'The MBTI House' },
        { heading: 'Character', body: '@steady_hands' },
      ],
    });

    expect(prompt.system).toContain('VOTE');
    expect(prompt.system).toContain('Decide how this character votes.');
    expect(prompt.system).toContain(
      '{"decision": "upvote" | "downvote" | "skip"}',
    );
    expect(prompt.user).toContain('## World\nThe MBTI House');
    expect(prompt.user).toContain('## Character\n@steady_hands');
  });

  it('separates context sections', () => {
    const prompt = composeActionPrompt({
      action: 'POST',
      instructions: 'Write a post.',
      outputFormat: '{"title": string}',
      contextSections: [
        { heading: 'World', body: 'A' },
        { heading: 'Character', body: 'B' },
      ],
    });

    expect(prompt.user).toContain('## World\nA');
    expect(prompt.user).toContain('## Character\nB');
  });
});
