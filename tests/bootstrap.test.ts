import { beforeEach, it, expect } from 'vitest';
import { bootstrapAdmin } from '@/server/bootstrap';
import { db } from '@/server/db';
import { resetDb } from './helpers';
beforeEach(resetDb);
it('requires explicit strong credentials and refuses a second bootstrap', async () => {
  await expect(bootstrapAdmin({ email: '', name: 'Admin', password: '' })).rejects.toThrow();
  await bootstrapAdmin({ email: 'OWNER@EXAMPLE.COM', name: 'Owner', password: 'Bootstrap-secure-password-123!' });
  const user = await db.user.findFirstOrThrow();
  expect(user.email).toBe('owner@example.com');
  expect(user.mfaEnabled).toBe(false);
  await expect(bootstrapAdmin({ email: 'second@example.com', name: 'Second', password: 'Bootstrap-secure-password-123!' })).rejects.toThrow();
});
