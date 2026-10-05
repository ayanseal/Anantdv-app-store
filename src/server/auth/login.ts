import { z } from 'zod';
import { db } from '@/server/db';
import { AppError } from '@/server/errors';
import { hashPassword, verifyPassword, validatePassword } from './password';
import { issueSession, type SessionTokens } from './sessions';
import { admitAttempt } from './throttle';
import { createChallenge, resolveChallenge, claimChallenge } from './challenges';
export { createChallenge, resolveChallenge } from './challenges';
import { recordAudit } from '@/server/audit';
import { isMfaDisabled } from './principal';
export type LoginResult = { kind: 'session'; tokens: SessionTokens; role: string } | { kind: 'password' | 'mfa' | 'enroll'; challengeToken: string; role?: string };
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
  if (user.mustChangePassword) return { kind: 'password', challengeToken: await createChallenge(user.id, 'password', user.authVersion), role: user.role };
  if (user.role === 'ADMIN' && user.mfaEnabled && !isMfaDisabled()) {
    return { kind: 'mfa', challengeToken: await createChallenge(user.id, 'mfa', user.authVersion), role: user.role };
  }
  await recordAudit({ actorId: user.id, action: 'LOGIN' });
  return { kind: 'session', tokens: await issueSession(user.id, user.authVersion), role: user.role };
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
  if (user.role === 'ADMIN' && user.mfaEnabled && !isMfaDisabled()) {
    return { kind: 'mfa', challengeToken: await createChallenge(user.id, 'mfa', user.authVersion + 1), role: user.role };
  }
  return { kind: 'session', tokens: await issueSession(user.id, user.authVersion + 1), role: user.role };
}

export async function resetPasswordWithPrevious(emailInput: string, previousPassword: string, newPassword: string, ip: string): Promise<LoginResult> {
  const email = z.string().email().max(254).parse(emailInput.trim().toLowerCase());
  const accountKey = `account:${email}`;
  const ipKey = `ip:${ip}`;
  await admitAttempt(accountKey);
  await admitAttempt(ipKey, ip === 'local' ? 1000 : 100);

  const user = await db.user.findUnique({ where: { email }, include: { company: true } });
  const dummy = 'scrypt:00000000000000000000000000000000:' + '00'.repeat(64);
  const valid = await verifyPassword(previousPassword, user?.passwordHash ?? dummy);
  if (!valid || !user?.active || (user.role === 'CUSTOMER' && !user.company?.active)) {
    await recordAudit({ action: 'PASSWORD_RESET_REJECTED', metadata: { reason: 'Invalid previous password or inactive account' } });
    throw new AppError('CREDENTIALS', 401, 'Invalid email or previous password.');
  }

  if (previousPassword === newPassword) {
    throw new AppError('VALIDATION', 400, 'New password must be different from previous password.');
  }

  validatePassword(newPassword);
  const passwordHash = await hashPassword(newPassword);

  await db.$transaction(async tx => {
    await tx.user.update({
      where: { id: user.id },
      data: { passwordHash, mustChangePassword: false, authVersion: { increment: 1 } },
    });
    await tx.refreshSession.updateMany({ where: { userId: user.id }, data: { revokedAt: new Date() } });
    await tx.authChallenge.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } });
    await recordAudit({ actorId: user.id, action: 'PASSWORD_CHANGED', metadata: { source: 'forgot_password_reset' } }, tx);
  });

  return { kind: 'session', tokens: await issueSession(user.id, user.authVersion + 1), role: user.role };
}
