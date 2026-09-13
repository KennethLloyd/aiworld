import { WorldNarrativeResponse } from '@aiworld/shared/schemas/world-narrative-response.schema';
import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';

import { WorldNarrativeService } from '@/simulation/narrative/world-narrative.service';

@Controller('worlds/:slug/narrative')
export class WorldNarrativeController {
  constructor(private readonly narrativeService: WorldNarrativeService) {}

  @Get()
  @AllowAnonymous()
  async get(@Param('slug') slug: string): Promise<WorldNarrativeResponse> {
    const narrative = await this.narrativeService.getByWorldSlug(slug);
    if (!narrative) {
      throw new NotFoundException();
    }
    return narrative;
  }
}
