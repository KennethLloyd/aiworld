import '../src/lib/config/environment';
import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '@/generated/prisma/client';

import { seedWorld } from './seed-world';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

async function main() {
  const prisma = new PrismaClient({ adapter });

  try {
    const existingWorld = await prisma.world.findUnique({
      where: { slug: 'mbti-house' },
      select: { id: true },
    });

    if (existingWorld) {
      console.log(
        'The MBTI House already exists; leaving development data unchanged.',
      );
      return;
    }

    await seedWorld(prisma);
    console.log('Seeded The MBTI House (mbti-house).');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(async (error) => {
  console.error(error);
  process.exitCode = 1;
});
