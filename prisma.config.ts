import 'dotenv/config';
import { defineConfig } from 'prisma/config';
import path from 'node:path';
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: `file:${path.resolve((process.env.DATABASE_URL || 'file:./data/payana.db').slice(5)).replaceAll('\\', '/')}` },
});
