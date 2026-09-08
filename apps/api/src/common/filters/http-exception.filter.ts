import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ConflictException,
  ExceptionFilter,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import { Request, Response } from 'express';

import { redactDiagnostics } from '@/common/diagnostics';
import { SimulationActionError } from '@/simulation/actions/simulation-action.error';
import {
  InvalidSimulationStateTransitionError,
  SimulationConfigMalformedError,
  SimulationConfigNotFoundError,
  SimulationWorkRejectedError,
} from '@/simulation/lifecycle/simulation-lifecycle.error';
import {
  SimulationCharacterNotActiveError,
  SimulationIterationPickError,
} from '@/simulation/scheduler/simulation-scheduler.error';
import { WorldDeactivationRejectedError } from '@/world/world.error';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const httpException = mapDomainException(exception) ?? exception;

    if (httpException instanceof HttpException) {
      const status = httpException.getStatus();
      const exceptionResponse = httpException.getResponse();

      if (
        typeof exceptionResponse === 'object' &&
        exceptionResponse !== null &&
        'statusCode' in exceptionResponse &&
        'message' in exceptionResponse &&
        'error' in exceptionResponse
      ) {
        response.status(status).json(exceptionResponse);
        return;
      }

      response.status(status).json({
        statusCode: status,
        message:
          typeof exceptionResponse === 'string'
            ? exceptionResponse
            : httpException.message,
        error: httpException.name,
      });
      return;
    }

    const request = host.switchToHttp().getRequest<Request>();
    const errorName =
      exception instanceof Error ? exception.name : 'UnknownError';
    const stack = exception instanceof Error ? exception.stack : undefined;
    console.error(
      'Unhandled HTTP exception',
      JSON.stringify({
        errorName,
        method: request?.method,
        path: request?.path ?? request?.url?.split('?')[0],
        statusCode: 500,
        stack: stack ? redactDiagnostics(stack) : undefined,
      }),
    );
    response.status(500).json({
      statusCode: 500,
      message: 'Internal server error',
      error: 'Internal Server Error',
    });
  }
}

function mapDomainException(exception: unknown): HttpException | null {
  if (
    exception instanceof SimulationConfigNotFoundError ||
    (exception instanceof SimulationActionError &&
      exception.code === 'WORLD_NOT_FOUND')
  ) {
    return new NotFoundException();
  }
  if (
    exception instanceof SimulationCharacterNotActiveError ||
    exception instanceof SimulationConfigMalformedError
  ) {
    return new BadRequestException(exception.message);
  }
  if (
    exception instanceof InvalidSimulationStateTransitionError ||
    exception instanceof SimulationWorkRejectedError ||
    exception instanceof SimulationIterationPickError ||
    exception instanceof WorldDeactivationRejectedError
  ) {
    return new ConflictException(exception.message);
  }
  return null;
}
