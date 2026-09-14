import type { WorldNarrativeResponse } from '@aiworld/shared/schemas/world-narrative.schema';
import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';

import { WorldNarrativeService } from '@/simulation/narrative/world-narrative.service';
import { WorldService } from '@/world/world.service';

@Controller('worlds')
export class WorldNarrativeController {
  constructor(
    private readonly worlds: WorldService,
    private readonly narratives: WorldNarrativeService,
  ) {}

  @Get(':slug/narrative')
  @AllowAnonymous()
  async get(@Param('slug') slug: string): Promise<WorldNarrativeResponse> {
    const world = await this.worlds.getBySlug(slug);
    if (!world) throw new NotFoundException();
    return this.narratives.getPublic(world.id);
  }
}
