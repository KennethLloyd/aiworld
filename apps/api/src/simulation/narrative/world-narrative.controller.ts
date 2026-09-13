import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';

import { WorldNarrativeService } from './world-narrative.service';

@Controller('worlds')
export class WorldNarrativeController {
  constructor(private readonly narrativeService: WorldNarrativeService) {}

  @Get(':slug/narrative')
  @AllowAnonymous()
  async getNarrative(@Param('slug') slug: string) {
    const narrative = await this.narrativeService.getPublicBySlug(slug);
    if (!narrative) {
      throw new NotFoundException();
    }
    return narrative;
  }
}
