import { db } from '@/server/db';
import type { Prisma } from '@/generated/prisma/client';
export type AuditInput = { actorId?: string; action: string; targetId?: string; metadata?: Record<string, unknown> };
const allowed = new Set(['role', 'companyId', 'appId', 'version', 'active', 'published', 'reason', 'count']);
export async function recordAudit(input: AuditInput, client: Prisma.TransactionClient = db) {
  const metadata = Object.fromEntries(Object.entries(input.metadata ?? {}).filter(([key]) => allowed.has(key)));
  await client.auditEvent.create({ data: { actorId: input.actorId, action: input.action, targetId: input.targetId, metadata: JSON.stringify(metadata) } });
}
