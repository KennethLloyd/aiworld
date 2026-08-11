import { MockLlmFixture } from '@/simulation/providers/mock/mock-llm.provider';

// Order matters: `selectFixture` picks the first fixture whose id appears in
// the prompt as a whole word. Vote and comment prompts also mention the post
// they target, so `vote` and `comment` must come before `post`. A post prompt
// only ever mentions `post`, so it still matches after the earlier entries.
export const mockLlmFixtures: readonly MockLlmFixture[] = [
  {
    id: 'vote',
    output: {
      decision: 'upvote',
      reasoning: 'The point is clear and adds to the thread.',
    },
  },
  {
    id: 'comment',
    output: {
      content: 'I see it the same way.',
      parentCommentId: null,
      reasoning: 'Agreement keeps the thread warm.',
    },
  },
  {
    id: 'post',
    output: {
      title: 'The quiet power of a pause',
      content: 'Sometimes the strongest move is to wait before you speak.',
      reasoning: 'A reflective character values timing over noise.',
    },
  },
];
