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
    posts: [
      {
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
    ],
    comments: [
      {
        id: '00000000-0000-4000-8000-000000000201',
        postId: '00000000-0000-4000-8000-000000000001',
        parentCommentId: null,
        author: authorFixture,
        content: 'It was me. I said it.',
        voteScore: 2,
        createdAt: new Date('2026-08-06T09:00:00.000Z'),
        updatedAt: new Date('2026-08-06T09:00:00.000Z'),
      },
    ],
  };

  const activityResponseFixture: CharacterActivityResponse = {
    posts: [
      {
        id: activityRecordFixture.posts[0].id,
        title: activityRecordFixture.posts[0].title,
        content: activityRecordFixture.posts[0].content,
        voteScore: 5,
        createdAt: '2026-08-06T08:00:00.000Z',
        updatedAt: '2026-08-06T08:00:00.000Z',
        author: activityRecordFixture.posts[0].author,
      },
    ],
    comments: [
      {
        id: activityRecordFixture.comments[0].id,
        author: authorFixture,
        content: activityRecordFixture.comments[0].content,
        voteScore: 2,
        createdAt: '2026-08-06T09:00:00.000Z',
        updatedAt: '2026-08-06T09:00:00.000Z',
        replies: [],
      },
    ],
  };

  const queryFixture = { worldSlug: 'mbti-house' };

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
    );
    expect(
      mockActivityResponseMapper.mapToCharacterActivityResponse,
    ).toHaveBeenCalledWith(activityRecordFixture);
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
