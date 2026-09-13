import { MockLlmFixture } from '@/simulation/providers/mock/mock-llm.provider';

// Declared actions are matched before the legacy whole-prompt fallback. The
// fixture order remains explicit so minimal prompts can still select the
// intended action without matching incidental grounded-context words.
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
      content: 'The kitchen schedule makes that point worth discussing.',
      parentCommentId: null,
      reasoning: 'The reply stays grounded in the shared-house thread.',
    },
  },
  {
    id: 'post',
    output: {
      title: 'The quiet power of a pause',
      content:
        'The shared kitchen schedule needs a quiet pause before we speak.',
      reasoning:
        'The resident ties a reflective point to a concrete house detail.',
    },
  },
];
