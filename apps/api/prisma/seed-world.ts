import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '@/generated/prisma/client';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

export async function upsertWorld() {
  const world = await prisma.world.upsert({
    where: { slug: 'mbti' },
    create: {
      slug: 'mbti',
      name: 'MBTI Discussion',
      description: { about: 'A community for MBTI enthusiasts' },
      rules: ['Keep discussions civil.', 'Stay on MBTI topic.'],
      topicScope:
        'MBTI theory, personality types, cognitive functions, type compatibility, real-life type experiences',
      isActive: true,
    },
    update: {
      name: 'MBTI Discussion',
      description: { about: 'A community for MBTI enthusiasts' },
      rules: ['Keep discussions civil.', 'Stay on MBTI topic.'],
      topicScope:
        'MBTI theory, personality types, cognitive functions, type compatibility, real-life type experiences',
      isActive: true,
    },
  });

  console.log('Seed world:', world);
}

async function main() {
  await upsertWorld();
  console.log('Seed complete.');
}

main()
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
