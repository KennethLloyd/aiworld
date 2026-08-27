import { listSimulationLogsQuerySchema } from '@aiworld/shared/schemas/simulation-log.schema';
import type {
  ListSimulationLogsQuery,
  ListSimulationLogsResponse,
} from '@aiworld/shared/schemas/simulation-log.schema';
import { runCustomActionSchema } from '@aiworld/shared/schemas/simulation-run.schema';
import type {
  RunCustomAction,
  SimulationRunResultResponse,
} from '@aiworld/shared/schemas/simulation-run.schema';
import {
  updateSimulationSpeedSchema,
  updateSimulationStateSchema,
} from '@aiworld/shared/schemas/simulation-state.schema';
import type {
  SimulationConfigResponse,
  UpdateSimulationSpeed,
  UpdateSimulationState,
} from '@aiworld/shared/schemas/simulation-state.schema';
import type { SimulationTelemetryResponse } from '@aiworld/shared/schemas/simulation-telemetry.schema';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Roles } from '@thallesp/nestjs-better-auth';

import { ZodValidationPipe } from '@/common/pipes';
import { SimulationAdminResponseMapper } from '@/simulation/admin/simulation-admin-response.mapper';
import { mapSimulationAdminError } from '@/simulation/admin/simulation-admin.errors';
import { SimulationAdminService } from '@/simulation/admin/simulation-admin.service';

/** ADMIN-only simulation controls. Every mutation either changes persisted
 * configuration or enqueues a manual command through the scheduler port —
 * nothing here calls an LLM provider directly. Lifecycle gates (inactive
 * Worlds, HALTED manual work, and invalid transitions) surface as HTTP 409s
 * via the error mapper. */
@Controller('worlds/:slug/simulation')
export class SimulationAdminController {
  constructor(
    private readonly adminService: SimulationAdminService,
    private readonly responseMapper: SimulationAdminResponseMapper,
  ) {}

  @Get()
  @Roles(['ADMIN'])
  async getSimulation(
    @Param('slug') slug: string,
  ): Promise<SimulationConfigResponse> {
    try {
      return this.responseMapper.mapConfig(
        await this.adminService.getConfig(slug),
      );
    } catch (error) {
      throw mapSimulationAdminError(error);
    }
  }

  @Patch('state')
  @Roles(['ADMIN'])
  async updateState(
    @Param('slug') slug: string,
    @Body(new ZodValidationPipe(updateSimulationStateSchema))
    body: UpdateSimulationState,
  ): Promise<SimulationConfigResponse> {
    try {
      return this.responseMapper.mapConfig(
        await this.adminService.updateState(slug, body.state),
      );
    } catch (error) {
      throw mapSimulationAdminError(error);
    }
  }

  @Patch('speed')
  @Roles(['ADMIN'])
  async updateSpeed(
    @Param('slug') slug: string,
    @Body(new ZodValidationPipe(updateSimulationSpeedSchema))
    body: UpdateSimulationSpeed,
  ): Promise<SimulationConfigResponse> {
    try {
      return this.responseMapper.mapConfig(
        await this.adminService.updateSpeed(slug, body.speedMultiplier),
      );
    } catch (error) {
      throw mapSimulationAdminError(error);
    }
  }

  @Post('run-one-action')
  @HttpCode(200)
  @Roles(['ADMIN'])
  async runOneAction(
    @Param('slug') slug: string,
  ): Promise<SimulationRunResultResponse> {
    try {
      return this.responseMapper.mapRunResult(
        await this.adminService.runOneAction(slug),
      );
    } catch (error) {
      throw mapSimulationAdminError(error);
    }
  }

  @Post('custom-action')
  @HttpCode(200)
  @Roles(['ADMIN'])
  async runCustomAction(
    @Param('slug') slug: string,
    @Body(new ZodValidationPipe(runCustomActionSchema)) body: RunCustomAction,
  ): Promise<SimulationRunResultResponse> {
    try {
      return this.responseMapper.mapRunResult(
        await this.adminService.runCustomAction({
          slug,
          characterId: body.characterId,
          actionType: body.actionType,
        }),
      );
    } catch (error) {
      throw mapSimulationAdminError(error);
    }
  }

  @Get('telemetry')
  @Roles(['ADMIN'])
  async getTelemetry(
    @Param('slug') slug: string,
  ): Promise<SimulationTelemetryResponse> {
    try {
      return this.responseMapper.mapTelemetry(
        await this.adminService.getTelemetry(slug),
      );
    } catch (error) {
      throw mapSimulationAdminError(error);
    }
  }

  @Get('logs')
  @Roles(['ADMIN'])
  async getLogs(
    @Param('slug') slug: string,
    @Query(new ZodValidationPipe(listSimulationLogsQuerySchema))
    query: ListSimulationLogsQuery,
  ): Promise<ListSimulationLogsResponse> {
    try {
      return this.responseMapper.mapLogs(
        await this.adminService.listLogs({
          slug,
          filters: {
            characterId: query.characterId,
            action: query.action,
            status: query.status,
            executionSource: query.executionSource,
          },
          page: query.page,
          limit: query.limit,
        }),
      );
    } catch (error) {
      throw mapSimulationAdminError(error);
    }
  }
}
