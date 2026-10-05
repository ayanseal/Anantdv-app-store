import { PrismaClient } from '@/generated/prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { getConfig } from '@/config/env';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
const globalDb = globalThis as unknown as { payanaDb?: PrismaClient };
function createDb() {
  const config = getConfig();
  mkdirSync(path.dirname(config.databaseUrl.slice(5)), { recursive: true });
  const client = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: config.databaseUrl }) });
  client.$executeRawUnsafe('PRAGMA busy_timeout = 5000;').catch(() => {});
  return client;
}
export const db = globalDb.payanaDb ?? createDb();
if (process.env.NODE_ENV !== 'production') globalDb.payanaDb = db;
