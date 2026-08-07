import {
  ListWorldMembersResponse,
  WorldMemberResponse,
} from '@aiworld/shared/schemas/world-member-response.schema';
import {
  createWorldMemberSchema,
  listWorldMembersQuerySchema,
  updateWorldMemberSchema,
} from '@aiworld/shared/schemas/world-member.schema';
import type {
  CreateWorldMember,
  ListWorldMembersQuery,
  UpdateWorldMember,
} from '@aiworld/shared/schemas/world-member.schema';
import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Roles } from '@thallesp/nestjs-better-auth';

import { ZodValidationPipe } from '@/common/pipes';
import { WorldMemberResponseMapper } from '@/world-members/mappers/world-member-response.mapper';
import { WorldMembersService } from '@/world-members/world-members.service';

@Controller('world-members')
@Roles(['ADMIN'])
export class WorldMembersController {
  constructor(
    private readonly worldMembersService: WorldMembersService,
    private readonly worldMemberResponseMapper: WorldMemberResponseMapper,
  ) {}

  @Get()
  async list(
    @Query(new ZodValidationPipe(listWorldMembersQuerySchema))
    query: ListWorldMembersQuery,
  ): Promise<ListWorldMembersResponse> {
    const members = await this.worldMembersService.list(query);
    return this.worldMemberResponseMapper.mapToPaginatedWorldMemberResponse(
      members,
    );
  }

  @Get(':memberId')
  async getById(
    @Param('memberId') memberId: string,
  ): Promise<WorldMemberResponse> {
    const member = await this.worldMembersService.getById(memberId);
    if (!member) {
      throw new NotFoundException();
    }
    return this.worldMemberResponseMapper.mapToWorldMemberResponse(member);
  }

  @Post()
  async create(
    @Body(new ZodValidationPipe(createWorldMemberSchema))
    input: CreateWorldMember,
  ): Promise<WorldMemberResponse> {
    const member = await this.worldMembersService.create(input);
    return this.worldMemberResponseMapper.mapToWorldMemberResponse(member);
  }

  @Patch(':memberId')
  async update(
    @Param('memberId') memberId: string,
    @Body(new ZodValidationPipe(updateWorldMemberSchema))
    input: UpdateWorldMember,
  ): Promise<WorldMemberResponse> {
    const member = await this.worldMembersService.update(memberId, input);
    if (!member) {
      throw new NotFoundException();
    }
    return this.worldMemberResponseMapper.mapToWorldMemberResponse(member);
  }
}
