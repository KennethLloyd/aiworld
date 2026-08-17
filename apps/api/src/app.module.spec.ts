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
import { LlmProvider } from './simulation/providers/llm-provider.port';
import { MockLlmProvider } from './simulation/providers/mock/mock-llm.provider';
import { RetryingLlmProvider } from './simulation/providers/retry/retrying-llm.provider';

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

  describe('LLM provider selection', () => {
    it('resolves the mock provider through the registry by default', () => {
      const provider = module.get(LlmProvider);
      expect(provider).toBeInstanceOf(RetryingLlmProvider);
      expect((provider as RetryingLlmProvider).inner).toBeInstanceOf(
        MockLlmProvider,
      );
    });
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
