import { db } from '@/server/db';
import type { Prisma } from '@/generated/prisma/client';
import { promises as fs } from 'node:fs';
import path from 'node:path';

export type AuditInput = { actorId?: string; action: string; targetId?: string; metadata?: Record<string, unknown> };
const allowed = new Set(['role', 'companyId', 'appId', 'version', 'active', 'published', 'reason', 'count', 'icon', 'isPublic', 'logo']);

export const LOGS_DIR = path.resolve('./data/logs');
export const ACTIVITY_LOG_PATH = path.join(LOGS_DIR, 'activity.log');
export const ACTIVITY_JSONL_PATH = path.join(LOGS_DIR, 'activity.jsonl');

async function appendToFile(filePath: string, line: string) {
  try {
    await fs.mkdir(LOGS_DIR, { recursive: true });
    await fs.appendFile(filePath, line + '\n', 'utf8');
  } catch (err) {
    console.error('Failed to append to log file:', err);
  }
}

export async function recordAudit(input: AuditInput, client: Prisma.TransactionClient = db) {
  const metadata = Object.fromEntries(Object.entries(input.metadata ?? {}).filter(([key]) => allowed.has(key)));
  const event = await client.auditEvent.create({ data: { actorId: input.actorId, action: input.action, targetId: input.targetId, metadata: JSON.stringify(metadata) } });

  const timestamp = event.createdAt.toISOString();
  const humanLine = `[${timestamp}] ACTION: ${input.action.padEnd(20)} | Actor: ${input.actorId || 'system'} | Target: ${input.targetId || '-'} | Meta: ${JSON.stringify(metadata)}`;
  const jsonLine = JSON.stringify({ id: event.id, timestamp, action: input.action, actorId: input.actorId ?? null, targetId: input.targetId ?? null, metadata });

  void appendToFile(ACTIVITY_LOG_PATH, humanLine);
  void appendToFile(ACTIVITY_JSONL_PATH, jsonLine);
}
