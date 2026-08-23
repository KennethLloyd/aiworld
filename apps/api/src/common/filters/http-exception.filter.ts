import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
} from '@nestjs/common';
import { Request, Response } from 'express';

import { redactDiagnostics } from '@/common/diagnostics';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

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
            : exception.message,
        error: exception.name,
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
