import './src/lib/config/environment';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed-world.ts',
  },
  datasource: {
    url: process.env['DATABASE_URL'],
  },
});
