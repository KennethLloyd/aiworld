import type { SimulationHealthResponse } from '@aiworld/shared/schemas/simulation-health.schema';
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
import {
  mapSimulationConfig,
  mapSimulationHealth,
  mapSimulationLogs,
  mapSimulationRunResult,
  mapSimulationTelemetry,
} from '@/simulation/admin/simulation-admin-response.mapper';
import { SimulationAdminService } from '@/simulation/admin/simulation-admin.service';

/** Admin-only simulation controls; manual work goes through the scheduler. */
@Controller('worlds/:slug/simulation')
export class SimulationAdminController {
  constructor(private readonly adminService: SimulationAdminService) {}

  @Get()
  @Roles(['ADMIN'])
  async getSimulation(
    @Param('slug') slug: string,
  ): Promise<SimulationConfigResponse> {
    return mapSimulationConfig(await this.adminService.getConfig(slug));
  }

  @Patch('state')
  @Roles(['ADMIN'])
  async updateState(
    @Param('slug') slug: string,
    @Body(new ZodValidationPipe(updateSimulationStateSchema))
    body: UpdateSimulationState,
  ): Promise<SimulationConfigResponse> {
    return mapSimulationConfig(
      await this.adminService.updateState(slug, body.state),
    );
  }

  @Patch('speed')
  @Roles(['ADMIN'])
  async updateSpeed(
    @Param('slug') slug: string,
    @Body(new ZodValidationPipe(updateSimulationSpeedSchema))
    body: UpdateSimulationSpeed,
  ): Promise<SimulationConfigResponse> {
    return mapSimulationConfig(
      await this.adminService.updateSpeed(slug, body.speedMultiplier),
    );
  }

  @Post('run-one-action')
  @HttpCode(200)
  @Roles(['ADMIN'])
  async runOneAction(
    @Param('slug') slug: string,
  ): Promise<SimulationRunResultResponse> {
    return mapSimulationRunResult(await this.adminService.runOneAction(slug));
  }

  @Post('custom-action')
  @HttpCode(200)
  @Roles(['ADMIN'])
  async runCustomAction(
    @Param('slug') slug: string,
    @Body(new ZodValidationPipe(runCustomActionSchema)) body: RunCustomAction,
  ): Promise<SimulationRunResultResponse> {
    return mapSimulationRunResult(
      await this.adminService.runCustomAction({
        slug,
        characterId: body.characterId,
        actionType: body.actionType,
      }),
    );
  }

  @Get('health')
  @Roles(['ADMIN'])
  async getHealth(
    @Param('slug') slug: string,
  ): Promise<SimulationHealthResponse> {
    return mapSimulationHealth(await this.adminService.getHealth(slug));
  }

  @Get('telemetry')
  @Roles(['ADMIN'])
  async getTelemetry(
    @Param('slug') slug: string,
  ): Promise<SimulationTelemetryResponse> {
    return mapSimulationTelemetry(await this.adminService.getTelemetry(slug));
  }

  @Get('logs')
  @Roles(['ADMIN'])
  async getLogs(
    @Param('slug') slug: string,
    @Query(new ZodValidationPipe(listSimulationLogsQuerySchema))
    query: ListSimulationLogsQuery,
  ): Promise<ListSimulationLogsResponse> {
    return mapSimulationLogs(
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
  }
}
