import { z } from 'zod';
import { db } from '@/server/db';
import { AppError } from '@/server/errors';
import { hashPassword, verifyPassword } from './password';
import { issueSession, type SessionTokens } from './sessions';
import { admitAttempt } from './throttle';
import { createChallenge, resolveChallenge, claimChallenge } from './challenges';
export { createChallenge, resolveChallenge } from './challenges';
import { recordAudit } from '@/server/audit';
export type LoginResult = { kind: 'session'; tokens: SessionTokens } | { kind: 'password' | 'mfa' | 'enroll'; challengeToken: string };
export async function login(emailInput: string, password: string, ip: string): Promise<LoginResult> {
  const email = z.email().max(254).parse(emailInput.trim().toLowerCase());
  const accountKey = `account:${email}`;
  const ipKey = `ip:${ip}`;
  await admitAttempt(accountKey);
  // Untrusted deployments share a fallback key; per-account admission remains strict.
  await admitAttempt(ipKey, ip === 'local' ? 1000 : 100);
  const user = await db.user.findUnique({ where: { email }, include: { company: true } });
  // A real scrypt operation also runs for unknown accounts to reduce timing differences.
  const dummy = 'scrypt:00000000000000000000000000000000:' + '00'.repeat(64);
  const valid = await verifyPassword(password, user?.passwordHash ?? dummy);
  if (!valid || !user?.active || (user.role === 'CUSTOMER' && !user.company?.active)) {
    await recordAudit({ action: 'LOGIN_REJECTED', metadata: { reason: 'Invalid credentials or inactive account' } });
    throw new AppError('CREDENTIALS', 401, 'Invalid email or password.');
  }
  await db.loginThrottle.deleteMany({ where: { key: accountKey } });
  if (user.mustChangePassword) return { kind: 'password', challengeToken: await createChallenge(user.id, 'password', user.authVersion) };
  if (user.role === 'ADMIN') {
    const purpose = user.mfaEnabled ? 'mfa' : 'enroll';
    return { kind: purpose, challengeToken: await createChallenge(user.id, purpose, user.authVersion) };
  }
  await recordAudit({ actorId: user.id, action: 'LOGIN' });
  return { kind: 'session', tokens: await issueSession(user.id, user.authVersion) };
}
export async function changePassword(challengeToken: string, newPassword: string): Promise<LoginResult> {
  const user = await resolveChallenge(challengeToken, 'password');
  if (await verifyPassword(newPassword, user.passwordHash)) throw new AppError('VALIDATION', 400, 'Choose a different password.');
  const passwordHash = await hashPassword(newPassword);
  await db.$transaction(async tx => {
    await claimChallenge(tx, challengeToken, 'password', user.id, user.authVersion);
    await tx.user.update({ where: { id: user.id }, data: { passwordHash, mustChangePassword: false, authVersion: { increment: 1 } } });
    await tx.refreshSession.updateMany({ where: { userId: user.id }, data: { revokedAt: new Date() } });
    await tx.authChallenge.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } });
    await recordAudit({ actorId: user.id, action: 'PASSWORD_CHANGED' }, tx);
  });
  if (user.role === 'ADMIN') {
    const kind = user.mfaEnabled ? 'mfa' : 'enroll';
    return { kind, challengeToken: await createChallenge(user.id, kind, user.authVersion + 1) };
  }
  return { kind: 'session', tokens: await issueSession(user.id, user.authVersion + 1) };
}
