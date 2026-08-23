import { SimulationOutputSafetyError } from './simulation-action.error';
import { assertSafeSimulationOutput } from './simulation-output-safety';

describe('simulation output safety', () => {
  it('accepts bounded plain-text output for every action', () => {
    expect(() =>
      assertSafeSimulationOutput('POST', {
        title: 'A useful household note',
        content: 'The kitchen schedule is worth discussing.',
        reasoning: 'The topic is inside the World scope.',
      }),
    ).not.toThrow();

    expect(() =>
      assertSafeSimulationOutput('COMMENT', {
        content: 'That is a fair point.',
        parentCommentId: null,
        reasoning: 'The response continues the thread.',
      }),
    ).not.toThrow();

    expect(() =>
      assertSafeSimulationOutput('VOTE', {
        decision: 'upvote',
        reasoning: 'The post adds a useful perspective.',
      }),
    ).not.toThrow();
  });

  it.each([
    ['executable markup', '<script>alert(1)</script>'],
    ['link markup', '<a href="https://example.com">link</a>'],
    ['image event markup', '<img src="x" onerror="alert(1)">'],
    ['comment markup', '<!-- hidden -->'],
    ['credential-shaped text', 'authorization: Bearer secret'],
    ['control characters', 'line\u0000break'],
  ])('rejects %s without publishing it', (_label, content) => {
    expect(() =>
      assertSafeSimulationOutput('COMMENT', {
        content,
        parentCommentId: null,
        reasoning: 'A reason.',
      }),
    ).toThrow(SimulationOutputSafetyError);
  });

  it('rejects overlong fields with an operator-readable failure', () => {
    expect(() =>
      assertSafeSimulationOutput('POST', {
        title: 'x'.repeat(161),
        content: 'A post.',
        reasoning: 'A reason.',
      }),
    ).toThrow('title exceeds the 160-character safety limit');
  });
});
