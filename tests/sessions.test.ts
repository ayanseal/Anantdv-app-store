import { beforeEach, it, expect } from 'vitest';
import { db } from '@/server/db';
import { fixture, resetDb } from './helpers';
import { verifyPassword } from '@/server/auth/password';
import { issueSession, rotateSession, revokeSessions, principalFromAccess } from '@/server/auth/sessions';
beforeEach(resetDb);
it('verifies passwords without storing plaintext', async () => {
  const f = await fixture();
  expect(f.customer.passwordHash).not.toContain('Long-test-password');
  expect(await verifyPassword('Long-test-password-123!', f.customer.passwordHash)).toBe(true);
  expect(await verifyPassword('wrong-password', f.customer.passwordHash)).toBe(false);
});
it('rotates refresh tokens and revokes the family after reuse', async () => {
  const f = await fixture();
  const first = await issueSession(f.customer.id);
  const second = await rotateSession(first.refreshToken);
  expect(second.refreshToken).not.toBe(first.refreshToken);
  expect((await principalFromAccess(second.accessToken)).id).toBe(f.customer.id);
  await expect(rotateSession(first.refreshToken)).rejects.toThrow();
  await expect(principalFromAccess(second.accessToken)).rejects.toThrow();
  await expect(rotateSession(second.refreshToken)).rejects.toThrow();
  const rows = await db.refreshSession.findMany();
  expect(rows.every(row => row.tokenHash !== first.refreshToken && row.tokenHash !== second.refreshToken)).toBe(true);
});
it('allows at most one atomic refresh consumption', async () => {
  const f = await fixture();
  const first = await issueSession(f.customer.id);
  const results = await Promise.allSettled([rotateSession(first.refreshToken), rotateSession(first.refreshToken)]);
  expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
});
it('revokes access on logout, disable, role change and expiry', async () => {
  const f = await fixture();
  const session = await issueSession(f.customer.id);
  await db.user.update({ where: { id: f.customer.id }, data: { active: false } });
  await expect(principalFromAccess(session.accessToken)).rejects.toThrow();
  await db.user.update({ where: { id: f.customer.id }, data: { active: true, authVersion: { increment: 1 } } });
  await expect(principalFromAccess(session.accessToken)).rejects.toThrow();
  const fresh = await issueSession(f.customer.id);
  await revokeSessions(f.customer.id);
  await expect(principalFromAccess(fresh.accessToken)).rejects.toThrow();
  await expect(rotateSession(fresh.refreshToken)).rejects.toThrow();
  const expired = await issueSession(f.viewer.id);
  await db.refreshSession.updateMany({ where: { userId: f.viewer.id }, data: { expiresAt: new Date(0) } });
  await expect(rotateSession(expired.refreshToken)).rejects.toThrow();
});
it('rejects session issuance from an outdated credential proof', async () => {
  const f = await fixture();
  await db.user.update({ where: { id: f.customer.id }, data: { authVersion: { increment: 1 } } });
  await expect(issueSession(f.customer.id, 0)).rejects.toThrow();
  expect(await db.refreshSession.count()).toBe(0);
});
