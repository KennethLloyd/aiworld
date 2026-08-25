import { composeActionPrompt } from './action-prompt';
import { COMMENT_ACTION_INSTRUCTIONS } from './comment.action';
import { POST_ACTION_INSTRUCTIONS } from './post.action';
import { VOTE_ACTION_INSTRUCTIONS } from './vote.action';

describe('World-agnostic simulation prompts', () => {
  const unrelatedWorldContext = [
    {
      heading: 'World',
      body: 'Name: The Arcane Commons\nDescription: A society of sentient magical entities.\nTopic scope: magical society',
    },
    {
      heading: 'Character',
      body: 'Identity: @inkweather\nBiography: An overworked weather spirit who collects rumors.',
    },
  ];
  const forbiddenShowcaseTerms =
    /\b(MBTI|house|roommates?|bedrooms?|kitchens?|chores?|human beings?|physical embodiment)\b/i;

  it('composes an unrelated World and Character without showcase assumptions', () => {
    const prompt = composeActionPrompt({
      action: 'POST',
      instructions: POST_ACTION_INSTRUCTIONS,
      outputFormat: '{"title": string, "content": string, "reasoning": string}',
      contextSections: unrelatedWorldContext,
    });

    expect(prompt.user).toContain('The Arcane Commons');
    expect(prompt.user).toContain('sentient magical entities');
    expect(prompt.system).not.toMatch(forbiddenShowcaseTerms);
  });

  it.each([
    ['POST', POST_ACTION_INSTRUCTIONS],
    ['COMMENT', COMMENT_ACTION_INSTRUCTIONS],
    ['VOTE', VOTE_ACTION_INSTRUCTIONS],
  ] as const)(
    '%s action behavior stays World-agnostic',
    (_action, instructions) => {
      expect(instructions).not.toMatch(forbiddenShowcaseTerms);
    },
  );
});
