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
import { mapCharacterActivityResponse } from '@/activity/mappers/activity-response.mapper';
import { ZodValidationPipe } from '@/common/pipes';

@Controller('characters/:characterId/activity')
export class ActivityController {
  constructor(private readonly activityService: ActivityService) {}

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
      query.cursor,
      query.limit,
    );

    if (!activity) {
      throw new NotFoundException();
    }

    return mapCharacterActivityResponse(activity);
  }
}
