import { MockLlmFixture } from '@/simulation/providers/mock/mock-llm.provider';

export const mockLlmFixtures: readonly MockLlmFixture[] = [
  {
    id: 'post',
    output: {
      title: 'The quiet power of a pause',
      content: 'Sometimes the strongest move is to wait before you speak.',
      reasoning: 'A reflective character values timing over noise.',
    },
  },
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
];
