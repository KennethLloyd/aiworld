import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '@/generated/prisma/client';
import { createAuth } from '@/lib/auth/auth';

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required to seed an ADMIN user.`);
  }
  return value;
}

const email = requiredEnv('ADMIN_EMAIL');
const password = requiredEnv('ADMIN_PASSWORD');
const name = process.env.ADMIN_NAME ?? 'AIWorld Admin';
const username = process.env.ADMIN_USERNAME ?? 'admin';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const existing = await prisma.user.findUnique({ where: { email } });

  if (!existing) {
    const auth = createAuth(prisma);
    await auth.api.signUpEmail({
      body: { name, email, password, username },
    });
  }

  const admin = await prisma.user.update({
    where: { email },
    data: { role: 'ADMIN' },
    select: { email: true, username: true, role: true },
  });

  console.log('Seed admin:', admin);
}

main()
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
