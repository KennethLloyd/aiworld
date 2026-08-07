import { Test, TestingModule } from '@nestjs/testing';

import { ActivityService } from '@/activity/activity.service';
import { CharacterRecord } from '@/characters/domain/character-record';
import { CharacterRepository } from '@/characters/repositories/character-repository.interface';
import {
  AuthorRecord,
  FlatCommentRecord,
} from '@/comments/domain/comment-record';
import { CommentRepository } from '@/comments/repositories/comment-repository.interface';
import { PostWithAuthorRecord } from '@/posts/domain/post-record';
import { PostRepository } from '@/posts/repositories/post-repository.interface';
import { WorldMemberRepository } from '@/world-members/repositories/world-member-repository.interface';
import { WorldRecord } from '@/world/domain/world-record';
import { WorldService } from '@/world/world.service';

describe('ActivityService', () => {
  let service: ActivityService;

  const worldRecordFixture: WorldRecord = {
    id: '00000000-0000-4000-8000-000000000001',
    name: 'The MBTI House',
    slug: 'mbti-house',
    description: { about: '16 personality types in a shared space' },
    rules: [],
    topicScope: 'MBTI theory and house life',
    isActive: true,
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
    updatedAt: new Date('2026-08-01T00:00:00.000Z'),
  };

  const characterFixture: CharacterRecord = {
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

  const inactiveCharacterFixture: CharacterRecord = {
    ...characterFixture,
    id: '00000000-0000-4000-8000-000000000102',
    isActive: false,
  };

  const membershipFixture = { id: '00000000-0000-4000-8000-000000000201' };

  const authorFixture: AuthorRecord = {
    id: characterFixture.id,
    handle: 'standard_procedure',
    name: 'Standard_Procedure',
    avatarUrl: null,
  };

  const postFixture: PostWithAuthorRecord = {
    id: '00000000-0000-4000-8000-000000000301',
    title: 'Who actually uses the microwave for FISH?',
    content: 'It smells like low tide.',
    voteScore: 5,
    createdAt: new Date('2026-08-06T08:00:00.000Z'),
    updatedAt: new Date('2026-08-06T08:00:00.000Z'),
    author: authorFixture,
  };

  const commentFixture: FlatCommentRecord = {
    id: '00000000-0000-4000-8000-000000000401',
    postId: postFixture.id,
    parentCommentId: null,
    author: authorFixture,
    content: 'It was me. I said it.',
    voteScore: 2,
    createdAt: new Date('2026-08-06T09:00:00.000Z'),
    updatedAt: new Date('2026-08-06T09:00:00.000Z'),
  };

  const mockWorldService: jest.Mocked<Pick<WorldService, 'getBySlug'>> = {
    getBySlug: jest.fn(),
  };

  const mockCharacterRepository: jest.Mocked<
    Pick<CharacterRepository, 'findById'>
  > = {
    findById: jest.fn(),
  };

  const mockWorldMemberRepository: jest.Mocked<
    Pick<WorldMemberRepository, 'findByWorldAndCharacter'>
  > = {
    findByWorldAndCharacter: jest.fn(),
  };

  const mockPostRepository: jest.Mocked<
    Pick<PostRepository, 'findByAuthorMembership'>
  > = {
    findByAuthorMembership: jest.fn(),
  };

  const mockCommentRepository: jest.Mocked<
    Pick<CommentRepository, 'findByAuthorMembership'>
  > = {
    findByAuthorMembership: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActivityService,
        { provide: WorldService, useValue: mockWorldService },
        { provide: CharacterRepository, useValue: mockCharacterRepository },
        {
          provide: WorldMemberRepository,
          useValue: mockWorldMemberRepository,
        },
        { provide: PostRepository, useValue: mockPostRepository },
        { provide: CommentRepository, useValue: mockCommentRepository },
      ],
    }).compile();

    service = module.get<ActivityService>(ActivityService);
    jest.clearAllMocks();
  });

  it('resolves the world and character, then delegates to both repositories with the membership id', async () => {
    mockWorldService.getBySlug.mockResolvedValue(worldRecordFixture);
    mockCharacterRepository.findById.mockResolvedValue(characterFixture);
    mockWorldMemberRepository.findByWorldAndCharacter.mockResolvedValue(
      membershipFixture,
    );
    mockPostRepository.findByAuthorMembership.mockResolvedValue([postFixture]);
    mockCommentRepository.findByAuthorMembership.mockResolvedValue([
      commentFixture,
    ]);

    const activity = await service.findActivity(
      characterFixture.id,
      'mbti-house',
    );

    expect(activity).toEqual({
      posts: [postFixture],
      comments: [commentFixture],
    });
    expect(mockWorldService.getBySlug).toHaveBeenCalledWith(
      'mbti-house',
      false,
    );
    expect(mockCharacterRepository.findById).toHaveBeenCalledWith(
      characterFixture.id,
    );
    expect(
      mockWorldMemberRepository.findByWorldAndCharacter,
    ).toHaveBeenCalledWith(worldRecordFixture.id, characterFixture.id);
    expect(mockPostRepository.findByAuthorMembership).toHaveBeenCalledWith(
      worldRecordFixture.id,
      membershipFixture.id,
    );
    expect(mockCommentRepository.findByAuthorMembership).toHaveBeenCalledWith(
      worldRecordFixture.id,
      membershipFixture.id,
    );
  });

  it('returns null without resolving anything else when the world is missing', async () => {
    mockWorldService.getBySlug.mockResolvedValue(null);

    const activity = await service.findActivity('some-character', 'missing');

    expect(activity).toBeNull();
    expect(mockCharacterRepository.findById).not.toHaveBeenCalled();
    expect(
      mockWorldMemberRepository.findByWorldAndCharacter,
    ).not.toHaveBeenCalled();
    expect(mockPostRepository.findByAuthorMembership).not.toHaveBeenCalled();
    expect(mockCommentRepository.findByAuthorMembership).not.toHaveBeenCalled();
  });

  it('returns null without querying membership when the character is missing', async () => {
    mockWorldService.getBySlug.mockResolvedValue(worldRecordFixture);
    mockCharacterRepository.findById.mockResolvedValue(null);

    const activity = await service.findActivity(
      '00000000-0000-4000-8000-00000000dead',
      'mbti-house',
    );

    expect(activity).toBeNull();
    expect(
      mockWorldMemberRepository.findByWorldAndCharacter,
    ).not.toHaveBeenCalled();
    expect(mockPostRepository.findByAuthorMembership).not.toHaveBeenCalled();
    expect(mockCommentRepository.findByAuthorMembership).not.toHaveBeenCalled();
  });

  it('returns an empty activity when the character has no membership in the world', async () => {
    mockWorldService.getBySlug.mockResolvedValue(worldRecordFixture);
    mockCharacterRepository.findById.mockResolvedValue(characterFixture);
    mockWorldMemberRepository.findByWorldAndCharacter.mockResolvedValue(null);

    const activity = await service.findActivity(
      characterFixture.id,
      'mbti-house',
    );

    expect(activity).toEqual({ posts: [], comments: [] });
    expect(mockPostRepository.findByAuthorMembership).not.toHaveBeenCalled();
    expect(mockCommentRepository.findByAuthorMembership).not.toHaveBeenCalled();
  });

  it('resolves inactive characters without the active filter and still lists their content', async () => {
    mockWorldService.getBySlug.mockResolvedValue(worldRecordFixture);
    mockCharacterRepository.findById.mockResolvedValue(
      inactiveCharacterFixture,
    );
    mockWorldMemberRepository.findByWorldAndCharacter.mockResolvedValue(
      membershipFixture,
    );
    mockPostRepository.findByAuthorMembership.mockResolvedValue([postFixture]);
    mockCommentRepository.findByAuthorMembership.mockResolvedValue([]);

    const activity = await service.findActivity(
      inactiveCharacterFixture.id,
      'mbti-house',
    );

    expect(activity).toEqual({ posts: [postFixture], comments: [] });
    expect(mockCharacterRepository.findById).toHaveBeenCalledWith(
      inactiveCharacterFixture.id,
    );
    expect(mockPostRepository.findByAuthorMembership).toHaveBeenCalledWith(
      worldRecordFixture.id,
      membershipFixture.id,
    );
  });
});
