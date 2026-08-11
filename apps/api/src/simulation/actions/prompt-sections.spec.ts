import { threadSection } from './prompt-sections';

function comment(
  id: string,
  content: string,
  parentCommentId: string | null,
  createdAt: string,
) {
  return {
    id,
    postId: 'post-1',
    parentCommentId,
    author: { id: `member-${id}`, handle: id, name: id, avatarUrl: null },
    content,
    voteScore: 0,
    createdAt: new Date(createdAt),
    updatedAt: new Date(createdAt),
    postTitle: 'A thought',
  };
}

describe('threadSection', () => {
  it('formats the most recent comments', () => {
    const thread = [
      comment('a', 'First.', null, '2026-01-01'),
      comment('b', 'Second.', null, '2026-01-02'),
      comment('c', 'Third.', null, '2026-01-03'),
    ];

    const section = threadSection(thread, undefined);

    expect(section.body).toContain('@b: Second.');
    expect(section.body).toContain('@c: Third.');
  });

  it('includes the parent chain when a parent is given', () => {
    const thread = [
      comment('root', 'Root.', null, '2026-01-01'),
      comment('mid', 'Middle.', 'root', '2026-01-02'),
      comment('leaf', 'Leaf.', 'mid', '2026-01-03'),
    ];

    const section = threadSection(thread, 'leaf');

    expect(section.body.split('\n')).toEqual([
      '@root: Root.',
      '@mid: Middle.',
      '@leaf: Leaf.',
    ]);
  });

  it('bounds the thread to the parent chain plus recent comments', () => {
    const thread = Array.from({ length: 12 }, (_, index) =>
      comment(
        `c${index}`,
        `Comment ${index}.`,
        null,
        `2026-01-0${(index % 9) + 1}`,
      ),
    );
    const section = threadSection(thread, undefined, 3);

    expect(section.body.split('\n').length).toBe(3);
  });

  it('handles an empty thread', () => {
    const section = threadSection([], undefined);

    expect(section.body).toBe('(no comments yet)');
  });
});
