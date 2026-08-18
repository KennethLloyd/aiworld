import { CharacterActivityResponse } from '@aiworld/shared/schemas/activity-response.schema';
import { NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';

import { ActivityController } from '@/activity/activity.controller';
import { ActivityService } from '@/activity/activity.service';
import { ActivityResponseMapper } from '@/activity/mappers/activity-response.mapper';

describe('ActivityController', () => {
  let controller: ActivityController;

  const authorFixture = {
    id: '00000000-0000-4000-8000-000000000111',
    handle: 'standard_procedure',
    name: 'Standard_Procedure',
    avatarUrl: null,
  };

  const activityRecordFixture = {
    items: [
      {
        kind: 'post' as const,
        record: {
          id: '00000000-0000-4000-8000-000000000001',
          title: 'Who actually uses the microwave for FISH?',
          content: 'It smells like low tide.',
          voteScore: 5,
          createdAt: new Date('2026-08-06T08:00:00.000Z'),
          updatedAt: new Date('2026-08-06T08:00:00.000Z'),
          author: {
            id: '00000000-0000-4000-8000-000000000101',
            handle: 'standard_procedure',
            name: 'Standard_Procedure',
            avatarUrl: null,
          },
        },
      },
      {
        kind: 'comment' as const,
        record: {
          id: '00000000-0000-4000-8000-000000000201',
          postId: '00000000-0000-4000-8000-000000000001',
          parentCommentId: null,
          author: authorFixture,
          content: 'It was me. I said it.',
          voteScore: 2,
          createdAt: new Date('2026-08-06T09:00:00.000Z'),
          updatedAt: new Date('2026-08-06T09:00:00.000Z'),
          postTitle: 'Who actually uses the microwave for FISH?',
        },
      },
    ],
    nextCursor: 'opaque-cursor-value',
  };

  const postRecordFixture = activityRecordFixture.items[0]!;
  const commentRecordFixture = activityRecordFixture.items[1]!;
  if (
    postRecordFixture.kind !== 'post' ||
    commentRecordFixture.kind !== 'comment'
  ) {
    throw new Error('Fixture shape mismatch');
  }

  const activityResponseFixture: CharacterActivityResponse = {
    items: [
      {
        kind: 'post',
        id: postRecordFixture.record.id,
        title: postRecordFixture.record.title,
        content: postRecordFixture.record.content,
        voteScore: 5,
        createdAt: '2026-08-06T08:00:00.000Z',
        updatedAt: '2026-08-06T08:00:00.000Z',
        author: postRecordFixture.record.author,
      },
      {
        kind: 'comment',
        id: commentRecordFixture.record.id,
        author: authorFixture,
        content: commentRecordFixture.record.content,
        voteScore: 2,
        createdAt: '2026-08-06T09:00:00.000Z',
        updatedAt: '2026-08-06T09:00:00.000Z',
        replies: [],
        postId: commentRecordFixture.record.postId,
        postTitle: 'Who actually uses the microwave for FISH?',
      },
    ],
    nextCursor: 'opaque-cursor-value',
  };

  const queryFixture = {
    worldSlug: 'mbti-house',
    limit: 20,
    cursor: undefined,
  };

  const mockActivityService: jest.Mocked<
    Pick<ActivityService, 'findActivity'>
  > = {
    findActivity: jest.fn(),
  };

  const mockActivityResponseMapper: jest.Mocked<
    Pick<ActivityResponseMapper, 'mapToCharacterActivityResponse'>
  > = {
    mapToCharacterActivityResponse: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ActivityController],
      providers: [
        { provide: ActivityService, useValue: mockActivityService },
        {
          provide: ActivityResponseMapper,
          useValue: mockActivityResponseMapper,
        },
      ],
    }).compile();

    controller = module.get<ActivityController>(ActivityController);
    jest.clearAllMocks();
  });

  it('should return the mapped character activity', async () => {
    mockActivityService.findActivity.mockResolvedValue(activityRecordFixture);
    mockActivityResponseMapper.mapToCharacterActivityResponse.mockReturnValue(
      activityResponseFixture,
    );

    const response = await controller.getActivity(
      { characterId: '00000000-0000-4000-8000-000000000101' },
      queryFixture,
    );

    expect(response).toEqual(activityResponseFixture);
    expect(mockActivityService.findActivity).toHaveBeenCalledWith(
      '00000000-0000-4000-8000-000000000101',
      'mbti-house',
      undefined,
      20,
    );
    expect(
      mockActivityResponseMapper.mapToCharacterActivityResponse,
    ).toHaveBeenCalledWith(activityRecordFixture);
  });

  it('should forward the cursor and limit from the query', async () => {
    mockActivityService.findActivity.mockResolvedValue({
      items: [],
      nextCursor: null,
    });
    mockActivityResponseMapper.mapToCharacterActivityResponse.mockReturnValue({
      items: [],
      nextCursor: null,
    });

    await controller.getActivity(
      { characterId: '00000000-0000-4000-8000-000000000101' },
      { worldSlug: 'mbti-house', limit: 5, cursor: 'some-cursor' },
    );

    expect(mockActivityService.findActivity).toHaveBeenCalledWith(
      '00000000-0000-4000-8000-000000000101',
      'mbti-house',
      'some-cursor',
      5,
    );
  });

  it('should throw NotFoundException when the character or world is missing', async () => {
    mockActivityService.findActivity.mockResolvedValue(null);

    await expect(
      controller.getActivity(
        { characterId: 'missing-character' },
        queryFixture,
      ),
    ).rejects.toThrow(NotFoundException);
    expect(mockActivityService.findActivity).toHaveBeenCalledWith(
      'missing-character',
      'mbti-house',
      undefined,
      20,
    );
    expect(
      mockActivityResponseMapper.mapToCharacterActivityResponse,
    ).not.toHaveBeenCalled();
  });

  describe('access metadata', () => {
    const reflector = new Reflector();

    it('should be publicly accessible without a session', () => {
      expect(reflector.get<boolean>('PUBLIC', controller.getActivity)).toBe(
        true,
      );
    });
  });
});
