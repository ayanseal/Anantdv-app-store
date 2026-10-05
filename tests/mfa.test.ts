import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import * as OTPAuth from 'otpauth';
import { db } from '@/server/db';
import { fixture, resetDb } from './helpers';
import { beginEnrollment, finishEnrollment, verifyAdminFactor } from '@/server/auth/mfa';
import { login, resolveChallenge, changePassword } from '@/server/auth/login';
import { resetUserPassword } from '@/server/services/users';
import { loadPrincipal } from '@/server/auth/principal';
beforeEach(resetDb);
afterEach(() => vi.restoreAllMocks());
it('requires password verification then MFA before admin access', async () => {
  const f = await fixture();
  await expect(login(f.admin.email, 'wrong', 'test')).rejects.toThrow();
  const result = await login(f.admin.email, 'Long-test-password-123!', 'test');
  expect(result.kind).toBe('mfa');
  expect('accessToken' in result).toBe(false);
  if (result.kind !== 'session') {
    expect((await resolveChallenge(result.challengeToken, 'mfa')).id).toBe(f.admin.id);
    await expect(resolveChallenge(result.challengeToken, 'password')).rejects.toThrow();
    await db.authChallenge.updateMany({ data: { expiresAt: new Date(0) } });
    await expect(resolveChallenge(result.challengeToken, 'mfa')).rejects.toThrow();
  }
});
it('encrypts enrollment secrets and consumes recovery codes once', async () => {
  const f = await fixture();
  await db.user.update({ where: { id: f.admin.id }, data: { mfaEnabled: false } });
  const enrollment = await beginEnrollment(f.admin.id);
  expect(enrollment.otpauthUrl).toContain('otpauth://totp/');
  const user = await db.user.findUniqueOrThrow({ where: { id: f.admin.id } });
  expect(user.mfaSecret).not.toContain(enrollment.secret);
  await expect(finishEnrollment(f.admin.id, 'invalid')).rejects.toThrow();
  const totp = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(enrollment.secret), issuer: 'Anantdv App Store', label: f.admin.email, algorithm: 'SHA1', digits: 6, period: 30 });
  const { recoveryCodes } = await finishEnrollment(f.admin.id, totp.generate());
  expect(recoveryCodes).toHaveLength(10);
  await expect(finishEnrollment(f.admin.id, totp.generate())).rejects.toThrow();
  await expect(verifyAdminFactor(f.admin.id, { totp: totp.generate() })).rejects.toThrow();
  await verifyAdminFactor(f.admin.id, { recoveryCode: recoveryCodes[0] });
  await expect(verifyAdminFactor(f.admin.id, { recoveryCode: recoveryCodes[0] })).rejects.toThrow();
  expect((await db.recoveryCode.findMany()).every(row => !recoveryCodes.includes(row.codeHash))).toBe(true);
});
it('forces temporary password change before issuing a session', async () => {
  const f = await fixture();
  await db.user.update({ where: { id: f.customer.id }, data: { mustChangePassword: true } });
  const result = await login(f.customer.email, 'Long-test-password-123!', 'test');
  expect(result.kind).toBe('password');
  if (result.kind !== 'session') {
    await changePassword(result.challengeToken, 'Replacement-secure-password-123!');
    await expect(changePassword(result.challengeToken, 'Another-secure-password-123!')).rejects.toThrow();
  }
  expect((await db.user.findUniqueOrThrow({ where: { id: f.customer.id } })).mustChangePassword).toBe(false);
});
it('rejects a password proof whose account was reset while login was pending', async () => {
  const f = await fixture();
  await db.user.update({ where: { id: f.customer.id }, data: { mustChangePassword: true } });
  const actor = await loadPrincipal(f.admin.id);
  const read = db.user.findUnique.bind(db.user);
  // The production call only awaits Prisma's thenable; this scheduling adapter does not use its fluent relation methods.
  vi.spyOn(db.user, 'findUnique').mockImplementationOnce((async (args: Parameters<typeof db.user.findUnique>[0]) => {
    const snapshot = await read(args);
    await resetUserPassword(actor, f.customer.id);
    return snapshot;
  }) as unknown as typeof db.user.findUnique);
  await expect(login(f.customer.email, 'Long-test-password-123!', 'race')).rejects.toThrow();
  expect(await db.authChallenge.count({ where: { userId: f.customer.id, usedAt: null } })).toBe(0);
});
it('does not replace an authenticator enabled during enrollment preparation', async () => {
  const f = await fixture();
  await db.user.update({ where: { id: f.admin.id }, data: { mfaEnabled: false } });
  const initial = await beginEnrollment(f.admin.id);
  const code = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(initial.secret), digits: 6, period: 30 }).generate();
  const read = db.user.findUniqueOrThrow.bind(db.user);
  let enabledSecret = '';
  vi.spyOn(db.user, 'findUniqueOrThrow').mockImplementationOnce((async (args: Parameters<typeof db.user.findUniqueOrThrow>[0]) => {
    const snapshot = await read(args);
    await finishEnrollment(f.admin.id, code);
    enabledSecret = (await read({ where: { id: f.admin.id } })).mfaSecret!;
    return snapshot;
  }) as unknown as typeof db.user.findUniqueOrThrow);
  await expect(beginEnrollment(f.admin.id)).rejects.toThrow();
  expect((await read({ where: { id: f.admin.id } })).mfaSecret).toBe(enabledSecret);
});
