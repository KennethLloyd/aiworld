import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { of } from 'rxjs';

import { LoggingInterceptor } from './logging.interceptor';

describe('LoggingInterceptor', () => {
  let interceptor: LoggingInterceptor;

  beforeEach(() => {
    interceptor = new LoggingInterceptor();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('logs method, url, status code and elapsed time', () => {
    const logSpy = jest
      .spyOn(console, 'log')
      .mockImplementation(() => undefined);
    jest.spyOn(Date, 'now').mockReturnValueOnce(100).mockReturnValueOnce(112);

    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ method: 'GET', url: '/worlds?page=2' }),
        getResponse: () => ({ statusCode: 201 }),
      }),
    } as unknown as ExecutionContext;

    const callHandler: CallHandler = { handle: () => of(null) };

    interceptor.intercept(context, callHandler).subscribe();

    expect(logSpy).toHaveBeenCalledWith('GET /worlds?page=2 -> 201 +12ms');
  });
});
