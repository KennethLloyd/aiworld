import { CharacterActivityResponse } from '@aiworld/shared/schemas/activity-response.schema';
import {
  activityParamsSchema,
  activityQuerySchema,
} from '@aiworld/shared/schemas/activity.schema';
import type {
  ActivityParams,
  ActivityQuery,
} from '@aiworld/shared/schemas/activity.schema';
import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
} from '@nestjs/common';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';

import { ActivityService } from '@/activity/activity.service';
import { ActivityResponseMapper } from '@/activity/mappers/activity-response.mapper';
import { ZodValidationPipe } from '@/common/pipes';

@Controller('characters/:characterId/activity')
export class ActivityController {
  constructor(
    private readonly activityService: ActivityService,
    private readonly activityResponseMapper: ActivityResponseMapper,
  ) {}

  @Get()
  @AllowAnonymous()
  async getActivity(
    @Param(new ZodValidationPipe(activityParamsSchema)) params: ActivityParams,
    @Query(new ZodValidationPipe(activityQuerySchema))
    query: ActivityQuery,
  ): Promise<CharacterActivityResponse> {
    const activity = await this.activityService.findActivity(
      params.characterId,
      query.worldSlug,
    );

    if (!activity) {
      throw new NotFoundException();
    }

    return this.activityResponseMapper.mapToCharacterActivityResponse(activity);
  }
}
