import { Controller, Get } from '@nestjs/common';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';

@Controller()
export class AppController {
  @Get('health')
  @AllowAnonymous()
  health(): { status: 'ok' } {
    return { status: 'ok' };
  }

  @Get()
  @AllowAnonymous()
  index(): string {
    return 'Hello World!';
  }
}
