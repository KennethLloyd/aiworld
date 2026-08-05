jest.mock('@thallesp/nestjs-better-auth', () => ({
  AuthModule: class {
    static forRootAsync() {
      return { module: class {}, providers: [], exports: [] };
    }
  },
  Roles: () => () => {},
  AllowAnonymous: () => () => {},
}));

import { APP_GUARD } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';

import { AppModule } from './app.module';
import { PrismaModule } from './lib/database/prisma.module';

describe('AppModule', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaModule)
      .useValue({})
      .compile();
  });

  it('should be defined', () => {
    expect(module).toBeDefined();
  });

  describe('ThrottlerModule configuration', () => {
    it('should import ThrottlerModule', () => {
      const throttlerModule = module.get(ThrottlerModule);
      expect(throttlerModule).toBeDefined();
    });
  });

  describe('ThrottlerGuard as global guard', () => {
    it('should register ThrottlerGuard as APP_GUARD', () => {
      const appModuleMetadata = Reflect.getMetadata('providers', AppModule);
      expect(appModuleMetadata).toBeDefined();

      const guardProvider = appModuleMetadata.find(
        (provider: Record<string, unknown>) =>
          provider.provide === APP_GUARD ||
          provider.useClass === ThrottlerGuard,
      );
      expect(guardProvider).toBeDefined();
      expect(guardProvider.useClass).toBe(ThrottlerGuard);
    });
  });
});
