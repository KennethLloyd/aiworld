import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { ActivityService } from '@/activity/activity.service';
import {
  encodeActivityCursor,
  parseActivityCursor,
} from '@/activity/domain/activity-cursor';
import {
  CharacterView,
  CharactersService,
} from '@/characters/characters.service';
import { CommentsService } from '@/comments/comments.service';
import { Author, FlatComment } from '@/comments/domain/comment';
import { PostWithAuthor } from '@/posts/domain/post';
import { PostsService } from '@/posts/posts.service';
import { WorldMembersService } from '@/world-members/world-members.service';
import { WorldService, WorldView } from '@/world/world.service';

describe('ActivityService', () => {
  let service: ActivityService;

  const worldRecordFixture: WorldView = {
    id: '00000000-0000-4000-8000-000000000001',
    name: 'The MBTI House',
    slug: 'mbti-house',
    description: { about: '16 personality types in a shared space' },
    rules: [],
    topicScope: 'MBTI theory and house life',
    residentCount: 16,
    isActive: true,
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
    updatedAt: new Date('2026-08-01T00:00:00.000Z'),
  };

  const characterFixture: CharacterView = {
    id: '00000000-0000-4000-8000-000000000101',
    handle: 'standard_procedure',
    name: 'Standard_Procedure',
    classification: null,
    classificationGroup: null,
    avatarUrl: null,
    biography: 'A fixture character.',
    traits: [],
    systemPrompt: 'Synthetic.',
    isActive: true,
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
    updatedAt: new Date('2026-08-01T00:00:00.000Z'),
  };

  const inactiveCharacterFixture: CharacterView = {
    ...characterFixture,
    id: '00000000-0000-4000-8000-000000000102',
    isActive: false,
  };

  const membershipFixture = { id: '00000000-0000-4000-8000-000000000201' };

  const authorFixture: Author = {
    id: characterFixture.id,
    handle: 'standard_procedure',
    name: 'Standard_Procedure',
    avatarUrl: null,
  };

  const postFixture = (id: string, createdAt: Date): PostWithAuthor => ({
    id,
    title: 'Who actually uses the microwave for FISH?',
    content: 'It smells like low tide.',
    voteScore: 5,
    createdAt,
    updatedAt: createdAt,
    author: authorFixture,
  });

  const commentFixture = (
    id: string,
    createdAt: Date,
    postId = '00000000-0000-4000-8000-000000000301',
  ): FlatComment => ({
    id,
    postId,
    parentCommentId: null,
    author: authorFixture,
    content: 'It was me. I said it.',
    voteScore: 2,
    createdAt,
    updatedAt: createdAt,
    postTitle: 'Who actually uses the microwave for FISH?',
  });

  const t = (iso: string): Date => new Date(iso);

  const earlyPost = postFixture(
    '00000000-0000-4000-8000-000000000301',
    t('2026-08-06T08:00:00.000Z'),
  );
  const earlyComment = commentFixture(
    '00000000-0000-4000-8000-000000000401',
    t('2026-08-06T08:10:00.000Z'),
  );
  const middlePost = postFixture(
    '00000000-0000-4000-8000-000000000302',
    t('2026-08-06T08:20:00.000Z'),
  );
  const lateComment = commentFixture(
    '00000000-0000-4000-8000-000000000402',
    t('2026-08-06T08:30:00.000Z'),
  );
  const latestPost = postFixture(
    '00000000-0000-4000-8000-000000000303',
    t('2026-08-06T08:40:00.000Z'),
  );

  const mockWorldService: jest.Mocked<Pick<WorldService, 'getBySlug'>> = {
    getBySlug: jest.fn(),
  };

  const mockCharactersService: jest.Mocked<Pick<CharactersService, 'getById'>> =
    {
      getById: jest.fn(),
    };

  const mockWorldMembersService: jest.Mocked<
    Pick<WorldMembersService, 'findByWorldAndCharacter'>
  > = {
    findByWorldAndCharacter: jest.fn(),
  };

  const mockPostsService: jest.Mocked<
    Pick<PostsService, 'findByAuthorMembership'>
  > = {
    findByAuthorMembership: jest.fn(),
  };

  const mockCommentsService: jest.Mocked<
    Pick<CommentsService, 'findByAuthorMembership'>
  > = {
    findByAuthorMembership: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActivityService,
        { provide: WorldService, useValue: mockWorldService },
        { provide: CharactersService, useValue: mockCharactersService },
        {
          provide: WorldMembersService,
          useValue: mockWorldMembersService,
        },
        { provide: PostsService, useValue: mockPostsService },
        { provide: CommentsService, useValue: mockCommentsService },
      ],
    }).compile();

    service = module.get<ActivityService>(ActivityService);
    jest.clearAllMocks();
  });

  it('resolves the world and character, over-fetches one per stream, and merges the timeline', async () => {
    mockWorldService.getBySlug.mockResolvedValue(worldRecordFixture);
    mockCharactersService.getById.mockResolvedValue(characterFixture);
    mockWorldMembersService.findByWorldAndCharacter.mockResolvedValue(
      membershipFixture,
    );
    mockPostsService.findByAuthorMembership.mockResolvedValue([
      latestPost,
      middlePost,
      earlyPost,
    ]);
    mockCommentsService.findByAuthorMembership.mockResolvedValue([
      lateComment,
      earlyComment,
    ]);

    const activity = await service.findActivity(
      characterFixture.id,
      'mbti-house',
      undefined,
      20,
    );

    expect(activity).toEqual({
      items: [
        { kind: 'post', record: latestPost },
        { kind: 'comment', record: lateComment },
        { kind: 'post', record: middlePost },
        { kind: 'comment', record: earlyComment },
        { kind: 'post', record: earlyPost },
      ],
      nextCursor: null,
    });
    expect(mockWorldService.getBySlug).toHaveBeenCalledWith(
      'mbti-house',
      false,
    );
    expect(mockCharactersService.getById).toHaveBeenCalledWith(
      characterFixture.id,
      true,
    );
    expect(
      mockWorldMembersService.findByWorldAndCharacter,
    ).toHaveBeenCalledWith(worldRecordFixture.id, characterFixture.id);
    expect(mockPostsService.findByAuthorMembership).toHaveBeenCalledWith(
      worldRecordFixture.id,
      membershipFixture.id,
      null,
      21,
    );
    expect(mockCommentsService.findByAuthorMembership).toHaveBeenCalledWith(
      worldRecordFixture.id,
      membershipFixture.id,
      null,
      21,
    );
  });

  it('emits only the first `limit` items and a cursor to the next page when more remain', async () => {
    mockWorldService.getBySlug.mockResolvedValue(worldRecordFixture);
    mockCharactersService.getById.mockResolvedValue(characterFixture);
    mockWorldMembersService.findByWorldAndCharacter.mockResolvedValue(
      membershipFixture,
    );
    mockPostsService.findByAuthorMembership.mockResolvedValue([
      latestPost,
      middlePost,
    ]);
    mockCommentsService.findByAuthorMembership.mockResolvedValue([]);

    const activity = await service.findActivity(
      characterFixture.id,
      'mbti-house',
      undefined,
      1,
    );

    expect(activity?.items).toEqual([{ kind: 'post', record: latestPost }]);
    expect(activity?.nextCursor).not.toBeNull();
    const parsed = parseActivityCursor(activity?.nextCursor ?? undefined);
    expect(parsed).toEqual({
      ok: true,
      cursor: { createdAt: latestPost.createdAt, id: latestPost.id },
    });
  });

  it('returns a null nextCursor when the merged result fits on one page', async () => {
    mockWorldService.getBySlug.mockResolvedValue(worldRecordFixture);
    mockCharactersService.getById.mockResolvedValue(characterFixture);
    mockWorldMembersService.findByWorldAndCharacter.mockResolvedValue(
      membershipFixture,
    );
    mockPostsService.findByAuthorMembership.mockResolvedValue([latestPost]);
    mockCommentsService.findByAuthorMembership.mockResolvedValue([
      earlyComment,
    ]);

    const activity = await service.findActivity(
      characterFixture.id,
      'mbti-house',
      undefined,
      2,
    );

    expect(activity).toEqual({
      items: [
        { kind: 'post', record: latestPost },
        { kind: 'comment', record: earlyComment },
      ],
      nextCursor: null,
    });
  });

  it('decodes the cursor and passes it to both repositories on subsequent pages', async () => {
    mockWorldService.getBySlug.mockResolvedValue(worldRecordFixture);
    mockCharactersService.getById.mockResolvedValue(characterFixture);
    mockWorldMembersService.findByWorldAndCharacter.mockResolvedValue(
      membershipFixture,
    );
    mockPostsService.findByAuthorMembership.mockResolvedValue([]);
    mockCommentsService.findByAuthorMembership.mockResolvedValue([
      earlyComment,
    ]);

    const cursor = encodeActivityCursor({ kind: 'post', record: latestPost });

    await service.findActivity(characterFixture.id, 'mbti-house', cursor, 20);

    expect(mockPostsService.findByAuthorMembership).toHaveBeenCalledWith(
      worldRecordFixture.id,
      membershipFixture.id,
      { createdAt: latestPost.createdAt, id: latestPost.id },
      21,
    );
    expect(mockCommentsService.findByAuthorMembership).toHaveBeenCalledWith(
      worldRecordFixture.id,
      membershipFixture.id,
      { createdAt: latestPost.createdAt, id: latestPost.id },
      21,
    );
  });

  it('rejects a malformed cursor through the 400 validation envelope', async () => {
    mockWorldService.getBySlug.mockResolvedValue(worldRecordFixture);
    mockCharactersService.getById.mockResolvedValue(characterFixture);
    mockWorldMembersService.findByWorldAndCharacter.mockResolvedValue(
      membershipFixture,
    );

    let thrown: BadRequestException | undefined;
    try {
      await service.findActivity(
        characterFixture.id,
        'mbti-house',
        'not-a-cursor',
        20,
      );
    } catch (error) {
      thrown = error as BadRequestException;
    }

    expect(thrown).toBeInstanceOf(BadRequestException);
    const response = thrown?.getResponse() as Record<string, unknown>;
    expect(response.statusCode).toBe(400);
    expect(response.error).toBe('Validation Failed');
    const issues = response.message as Array<{ path: string[] }>;
    expect(issues[0]).toEqual(expect.objectContaining({ path: ['cursor'] }));
    expect(mockPostsService.findByAuthorMembership).not.toHaveBeenCalled();
    expect(mockCommentsService.findByAuthorMembership).not.toHaveBeenCalled();
  });

  it('returns null without resolving anything else when the world is missing', async () => {
    mockWorldService.getBySlug.mockResolvedValue(null);

    const activity = await service.findActivity(
      'some-character',
      'missing',
      undefined,
      20,
    );

    expect(activity).toBeNull();
    expect(mockCharactersService.getById).not.toHaveBeenCalled();
    expect(
      mockWorldMembersService.findByWorldAndCharacter,
    ).not.toHaveBeenCalled();
    expect(mockPostsService.findByAuthorMembership).not.toHaveBeenCalled();
    expect(mockCommentsService.findByAuthorMembership).not.toHaveBeenCalled();
  });

  it('returns null without querying membership when the character is missing', async () => {
    mockWorldService.getBySlug.mockResolvedValue(worldRecordFixture);
    mockCharactersService.getById.mockResolvedValue(null);

    const activity = await service.findActivity(
      '00000000-0000-4000-8000-00000000dead',
      'mbti-house',
      undefined,
      20,
    );

    expect(activity).toBeNull();
    expect(
      mockWorldMembersService.findByWorldAndCharacter,
    ).not.toHaveBeenCalled();
    expect(mockPostsService.findByAuthorMembership).not.toHaveBeenCalled();
    expect(mockCommentsService.findByAuthorMembership).not.toHaveBeenCalled();
  });

  it('returns an empty page with a null cursor when the character has no membership in the world', async () => {
    mockWorldService.getBySlug.mockResolvedValue(worldRecordFixture);
    mockCharactersService.getById.mockResolvedValue(characterFixture);
    mockWorldMembersService.findByWorldAndCharacter.mockResolvedValue(null);

    const activity = await service.findActivity(
      characterFixture.id,
      'mbti-house',
      undefined,
      20,
    );

    expect(activity).toEqual({ items: [], nextCursor: null });
    expect(mockPostsService.findByAuthorMembership).not.toHaveBeenCalled();
    expect(mockCommentsService.findByAuthorMembership).not.toHaveBeenCalled();
  });

  it('resolves inactive characters without the active filter and still lists their content', async () => {
    mockWorldService.getBySlug.mockResolvedValue(worldRecordFixture);
    mockCharactersService.getById.mockResolvedValue(inactiveCharacterFixture);
    mockWorldMembersService.findByWorldAndCharacter.mockResolvedValue(
      membershipFixture,
    );
    mockPostsService.findByAuthorMembership.mockResolvedValue([latestPost]);
    mockCommentsService.findByAuthorMembership.mockResolvedValue([]);

    const activity = await service.findActivity(
      inactiveCharacterFixture.id,
      'mbti-house',
      undefined,
      20,
    );

    expect(activity).toEqual({
      items: [{ kind: 'post', record: latestPost }],
      nextCursor: null,
    });
    expect(mockCharactersService.getById).toHaveBeenCalledWith(
      inactiveCharacterFixture.id,
      true,
    );
    expect(mockPostsService.findByAuthorMembership).toHaveBeenCalledWith(
      worldRecordFixture.id,
      membershipFixture.id,
      null,
      21,
    );
  });
});
