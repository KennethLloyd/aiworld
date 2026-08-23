import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    const now = Date.now();
    const requestPath = request.path ?? request.url.split('?')[0];

    return next.handle().pipe(
      tap(() => {
        console.log(
          `${request.method} ${requestPath} -> ${response.statusCode} +${Date.now() - now}ms`,
        );
      }),
    );
  }
}
