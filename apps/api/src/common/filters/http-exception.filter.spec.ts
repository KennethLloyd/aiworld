import { BadRequestException, type ArgumentsHost } from '@nestjs/common';
import type { Response } from 'express';

import { HttpExceptionFilter } from './http-exception.filter';

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;
  let status: jest.Mock;
  let json: jest.Mock;

  beforeEach(() => {
    filter = new HttpExceptionFilter();
    status = jest.fn().mockReturnThis();
    json = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const createHost = (): ArgumentsHost =>
    ({
      switchToHttp: () => ({
        getResponse: () => ({ status, json }) as unknown as Response,
        getRequest: () => ({
          method: 'GET',
          path: '/api/private',
          url: '/api/private?token=hidden',
        }),
      }),
    }) as unknown as ArgumentsHost;

  it('passes a BadRequestException envelope through unchanged', () => {
    const envelope = {
      statusCode: 400,
      message: [
        {
          code: 'too_small',
          minimum: 1,
          type: 'string',
          inclusive: true,
          exact: false,
          message: 'String must contain at least 1 character(s)',
          path: ['name'],
        },
      ],
      error: 'Validation Failed',
    };
    const exception = new BadRequestException(envelope);

    filter.catch(exception, createHost());

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(envelope);
  });

  it('logs unknown errors and returns a safe 500 response', () => {
    const errorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const error = new Error(
      'authorization: Bearer secret access_token=another-secret https://provider.test/body',
    );

    filter.catch(error, createHost());

    expect(errorSpy).toHaveBeenCalledWith(
      'Unhandled HTTP exception',
      expect.stringContaining('"errorName":"Error"'),
    );
    const diagnostics = errorSpy.mock.calls[0]?.[1] as string;
    expect(diagnostics).toContain('"path":"/api/private"');
    expect(diagnostics).toContain('[REDACTED]');
    expect(diagnostics).not.toContain('Bearer secret');
    expect(diagnostics).not.toContain('another-secret');
    expect(diagnostics).not.toContain('provider.test');
    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      statusCode: 500,
      message: 'Internal server error',
      error: 'Internal Server Error',
    });
  });
});
