import { Test } from '@nestjs/testing';

import { PrismaModule } from './prisma.module';
import { PrismaService } from './prisma.service';

function withEnv(
  env: Record<string, string>,
  fn: () => Promise<void>,
): () => Promise<void> {
  return async () => {
    const previous = { ...process.env };
    Object.assign(process.env, env);
    try {
      await fn();
    } finally {
      process.env = previous;
    }
  };
}

describe('PrismaModule', () => {
  it(
    'provides PrismaService as a global provider',
    withEnv({ DATABASE_URL: 'postgresql://localhost:5432/test' }, async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [PrismaModule],
      }).compile();

      const service = moduleRef.get(PrismaService);
      expect(service).toBeDefined();
    }),
  );
});
