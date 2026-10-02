import { beforeEach, it, expect } from 'vitest';
import { db } from '@/server/db';
import { recordAudit } from '@/server/audit';
import { resetDb } from './helpers';
beforeEach(resetDb);
it('records allowed metadata without credential leakage', async () => {
  await recordAudit({ action: 'USER_UPDATED', metadata: { role: 'CUSTOMER', password: 'never-store', token: 'never-store', secret: 'never-store' } });
  const event = await db.auditEvent.findFirstOrThrow();
  expect(JSON.parse(event.metadata)).toEqual({ role: 'CUSTOMER' });
});
