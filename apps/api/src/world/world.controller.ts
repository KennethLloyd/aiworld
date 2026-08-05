import {
  ListWorldsResponse,
  WorldResponse,
} from '@aiworld/shared/schemas/world-response.schema';
import {
  createWorldSchema,
  listWorldsQuerySchema,
  updateWorldSchema,
} from '@aiworld/shared/schemas/world.schema';
import type {
  CreateWorld,
  UpdateWorld,
  ListWorldsQuery,
} from '@aiworld/shared/schemas/world.schema';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { AllowAnonymous, Roles } from '@thallesp/nestjs-better-auth';

import { ZodValidationPipe } from '@/common/pipes';
import { WorldResponseMapper } from '@/world/mappers/world-response.mapper';
import { WorldService } from '@/world/world.service';

@Controller('worlds')
export class WorldController {
  constructor(
    private readonly worldService: WorldService,
    private readonly worldResponseMapper: WorldResponseMapper,
  ) {}

  @Post()
  @Roles(['ADMIN'])
  async create(
    @Body(new ZodValidationPipe(createWorldSchema)) createWorldDto: CreateWorld,
  ): Promise<WorldResponse> {
    const newWorld = await this.worldService.create(createWorldDto);

    return this.worldResponseMapper.mapToWorldResponse(newWorld);
  }

  @Patch(':slug')
  @Roles(['ADMIN'])
  async update(
    @Param('slug') slug: string,
    @Body(new ZodValidationPipe(updateWorldSchema)) updateWorldDto: UpdateWorld,
  ): Promise<WorldResponse> {
    const updatedWorld = await this.worldService.update(slug, updateWorldDto);

    if (!updatedWorld) {
      throw new NotFoundException();
    }

    return this.worldResponseMapper.mapToWorldResponse(updatedWorld);
  }

  @Get()
  @AllowAnonymous()
  async list(
    @Query(new ZodValidationPipe(listWorldsQuerySchema)) query: ListWorldsQuery,
  ): Promise<ListWorldsResponse> {
    const worlds = await this.worldService.list(query);

    return this.worldResponseMapper.mapToPaginatedWorldResponse(worlds);
  }

  @Get(':slug')
  @AllowAnonymous()
  async getBySlug(@Param('slug') slug: string): Promise<WorldResponse> {
    const world = await this.worldService.getBySlug(slug);
    if (!world) {
      throw new NotFoundException();
    }

    return this.worldResponseMapper.mapToWorldResponse(world);
  }

  @Delete(':slug')
  @HttpCode(204)
  @Roles(['ADMIN'])
  async delete(@Param('slug') slug: string): Promise<void> {
    const world = await this.worldService.getBySlug(slug);
    if (!world) {
      throw new NotFoundException();
    }

    await this.worldService.delete(slug);
  }
}
