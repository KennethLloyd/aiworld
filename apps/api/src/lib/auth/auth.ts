import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import type { DBFieldAttribute } from 'better-auth/db';
import { openAPI } from 'better-auth/plugins';

import { PrismaClient } from '@/generated/prisma/client';
import { getFrontendOrigins } from '@/lib/config/origins';
import { UserRole } from '@/types/userRole';

export const createAuth = (prisma: PrismaClient) => {
  const frontendOrigins = getFrontendOrigins();

  return betterAuth({
    ...(frontendOrigins.length > 0 ? { trustedOrigins: frontendOrigins } : {}),
    database: prismaAdapter(prisma, { provider: 'postgresql' }),
    emailAndPassword: {
      enabled: true,
    },
    user: {
      additionalFields: {
        username: {
          type: 'string',
          required: true,
          unique: true,
        },
        role: {
          type: 'string',
          defaultValue: 'USER' satisfies UserRole,
          input: false,
        },
        isDeleted: {
          type: 'boolean',
          defaultValue: false,
          input: false,
        },
      } satisfies Record<string, DBFieldAttribute>,
    },
    plugins: [openAPI({ path: 'docs' })],
  });
};
