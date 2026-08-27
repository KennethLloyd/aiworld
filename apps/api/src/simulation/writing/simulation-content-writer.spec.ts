import { CommentRepository } from '@/comments/repositories/comment-repository.interface';
import { PostRepository } from '@/posts/repositories/post-repository.interface';
import { SimulationWriteError } from '@/simulation/actions/simulation-action.error';
import { SimulationContentWriter } from '@/simulation/writing/simulation-content-writer';
import { VoteRepository } from '@/votes/repositories/vote-repository.interface';

function createWriter(overrides: {
  commentLinks?: Map<
    string,
    { id: string; postId: string; parentCommentId: string | null }
  >;
}) {
  const postRepository = {
    create: jest.fn().mockResolvedValue({ id: 'post-created' }),
  } as unknown as PostRepository;
  const voteRepository = {
    setForPost: jest.fn().mockResolvedValue({ id: 'vote-created' }),
  } as unknown as VoteRepository;
  const commentRepository = {
    create: jest.fn().mockResolvedValue({ id: 'comment-created' }),
    findById: jest
      .fn()
      .mockImplementation((id: string) =>
        Promise.resolve(overrides.commentLinks?.get(id) ?? null),
      ),
  } as unknown as CommentRepository;

  const writer = new SimulationContentWriter(
    postRepository,
    commentRepository,
    voteRepository,
  );

  return { writer, postRepository, voteRepository, commentRepository };
}

const postDecision = {
  action: 'POST' as const,
  worldId: 'world-1',
  memberId: 'member-1',
  characterId: 'character-1',
  title: 'A title',
  content: 'Body.',
  reasoning: 'R',
};

const voteDecision = {
  action: 'VOTE' as const,
  worldId: 'world-1',
  memberId: 'member-1',
  characterId: 'character-1',
  postId: 'post-1',
  decision: 'upvote' as const,
  reasoning: 'R',
};

const commentDecision = {
  action: 'COMMENT' as const,
  worldId: 'world-1',
  memberId: 'member-1',
  characterId: 'character-1',
  postId: 'post-1',
  content: 'Agreed.',
  parentCommentId: null,
  reasoning: 'R',
};

function commentAtDepth(
  depth: number,
): { id: string; postId: string; parentCommentId: string | null }[] {
  const links: {
    id: string;
    postId: string;
    parentCommentId: string | null;
  }[] = [];
  let parent: string | null = null;
  for (let level = 1; level <= depth; level += 1) {
    const id = `comment-depth-${level}`;
    links.push({ id, postId: 'post-1', parentCommentId: parent });
    parent = id;
  }
  return links;
}

describe('SimulationContentWriter', () => {
  it('persists a post through the post repository port', async () => {
    const { writer, postRepository } = createWriter({});

    const result = await writer.persistPost(postDecision);

    expect(result).toEqual({ id: 'post-created' });
    expect(postRepository.create).toHaveBeenCalledWith({
      worldId: 'world-1',
      authorMemberId: 'member-1',
      title: 'A title',
      content: 'Body.',
    });
  });

  it('persists desired upvote and downvote states', async () => {
    const { writer, voteRepository } = createWriter({});

    await writer.persistVote(voteDecision);
    await writer.persistVote({ ...voteDecision, decision: 'downvote' });

    expect(voteRepository.setForPost).toHaveBeenNthCalledWith(1, {
      postId: 'post-1',
      authorMemberId: 'member-1',
      value: 1,
    });
    expect(voteRepository.setForPost).toHaveBeenNthCalledWith(2, {
      postId: 'post-1',
      authorMemberId: 'member-1',
      value: -1,
    });
  });

  it('persists no row for a skipped vote', async () => {
    const { writer, voteRepository } = createWriter({});

    const result = await writer.persistVote({
      ...voteDecision,
      decision: 'skip',
    });

    expect(result).toBeNull();
    expect(voteRepository.setForPost).not.toHaveBeenCalled();
  });

  it('accepts a top-level comment without consulting parents', async () => {
    const { writer, commentRepository } = createWriter({});

    const result = await writer.persistComment(commentDecision);

    expect(result).toEqual({ id: 'comment-created' });
    expect(commentRepository.findById).not.toHaveBeenCalled();
    expect(commentRepository.create).toHaveBeenCalledWith({
      postId: 'post-1',
      authorMemberId: 'member-1',
      parentCommentId: null,
      content: 'Agreed.',
    });
  });

  it('accepts a reply at depth three', async () => {
    const links = commentAtDepth(2);
    const { writer, commentRepository } = createWriter({
      commentLinks: new Map(links.map((link) => [link.id, link])),
    });

    const result = await writer.persistComment({
      ...commentDecision,
      parentCommentId: 'comment-depth-2',
    });

    expect(result).toEqual({ id: 'comment-created' });
    expect(commentRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ parentCommentId: 'comment-depth-2' }),
    );
  });

  it('rejects a reply at depth four, never writing a row', async () => {
    const links = commentAtDepth(3);
    const { writer, commentRepository } = createWriter({
      commentLinks: new Map(links.map((link) => [link.id, link])),
    });

    await expect(
      writer.persistComment({
        ...commentDecision,
        parentCommentId: 'comment-depth-3',
      }),
    ).rejects.toBeInstanceOf(SimulationWriteError);

    await expect(
      writer.persistComment({
        ...commentDecision,
        parentCommentId: 'comment-depth-3',
      }),
    ).rejects.toMatchObject({ code: 'COMMENT_DEPTH_EXCEEDED' });
    expect(commentRepository.create).not.toHaveBeenCalled();
  });

  it('rejects a reply to a missing parent comment', async () => {
    const { writer, commentRepository } = createWriter({});

    await expect(
      writer.persistComment({ ...commentDecision, parentCommentId: 'missing' }),
    ).rejects.toMatchObject({ code: 'COMMENT_PARENT_NOT_FOUND' });
    expect(commentRepository.create).not.toHaveBeenCalled();
  });

  it('rejects a reply whose parent belongs to another post', async () => {
    const { writer, commentRepository } = createWriter({
      commentLinks: new Map([
        [
          'comment-other-post',
          {
            id: 'comment-other-post',
            postId: 'post-other',
            parentCommentId: null,
          },
        ],
      ]),
    });

    await expect(
      writer.persistComment({
        ...commentDecision,
        parentCommentId: 'comment-other-post',
      }),
    ).rejects.toMatchObject({ code: 'COMMENT_PARENT_POST_MISMATCH' });
    expect(commentRepository.create).not.toHaveBeenCalled();
  });

  it('dispatches any decision through persist', async () => {
    const { writer, postRepository, voteRepository, commentRepository } =
      createWriter({});

    await writer.persist(postDecision);
    await writer.persist(voteDecision);
    await writer.persist(commentDecision);

    expect(postRepository.create).toHaveBeenCalledTimes(1);
    expect(voteRepository.setForPost).toHaveBeenCalledTimes(1);
    expect(commentRepository.create).toHaveBeenCalledTimes(1);
  });
});
