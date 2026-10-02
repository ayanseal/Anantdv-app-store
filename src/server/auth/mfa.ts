import * as OTPAuth from 'otpauth';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { db } from '@/server/db';
import { getConfig } from '@/config/env';
import { AppError, unauthorized } from '@/server/errors';
import { tokenHash } from './password';
import { recordAudit } from '@/server/audit';
import { claimChallenge } from './challenges';
export function encryptSecret(secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', Buffer.from(getConfig().mfaEncryptionKey, 'hex'), iv);
  const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return `${iv.toString('hex')}:${cipher.getAuthTag().toString('hex')}:${ciphertext.toString('hex')}`;
}
function decryptSecret(value: string) {
  const [iv, tag, ciphertext] = value.split(':');
  const cipher = createDecipheriv('aes-256-gcm', Buffer.from(getConfig().mfaEncryptionKey, 'hex'), Buffer.from(iv, 'hex'));
  cipher.setAuthTag(Buffer.from(tag, 'hex'));
  return Buffer.concat([cipher.update(Buffer.from(ciphertext, 'hex')), cipher.final()]).toString('utf8');
}
const totpFor = (secret: string, email: string) => new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(secret), issuer: 'Payana App Store', label: email, algorithm: 'SHA1', digits: 6, period: 30 });
export async function beginEnrollment(userId: string, challengeToken?: string) {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.role !== 'ADMIN' || !user.active || user.mfaEnabled || user.mustChangePassword) throw unauthorized();
  const secret = new OTPAuth.Secret({ size: 20 }).base32;
  await db.$transaction(async tx => {
    if (challengeToken && !await tx.authChallenge.findFirst({ where: { tokenHash: tokenHash(challengeToken), userId, purpose: 'enroll', authVersion: user.authVersion, usedAt: null, expiresAt: { gt: new Date() } } })) throw unauthorized();
    const changed = await tx.user.updateMany({ where: { id: userId, active: true, role: 'ADMIN', mustChangePassword: false, mfaEnabled: false, authVersion: user.authVersion, mfaSecret: user.mfaSecret }, data: { mfaSecret: encryptSecret(secret), lastTotpStep: 0n } });
    if (!changed.count) throw unauthorized();
  });
  return { secret, otpauthUrl: totpFor(secret, user.email).toString() };
}
function validStep(encrypted: string, email: string, code: string) {
  if (!/^\d{6}$/.test(code)) throw new AppError('MFA', 400, 'Invalid authenticator code.');
  const timestamp = Date.now();
  const delta = totpFor(decryptSecret(encrypted), email).validate({ token: code, window: 1, timestamp });
  if (delta === null) throw new AppError('MFA', 400, 'Invalid authenticator code.');
  return BigInt(Math.floor(timestamp / 30000) + delta);
}
export async function finishEnrollment(userId: string, code: string, challengeToken?: string) {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.role !== 'ADMIN' || !user.active || !user.mfaSecret || user.mfaEnabled || user.mustChangePassword) throw unauthorized();
  const step = validStep(user.mfaSecret, user.email, code);
  const recoveryCodes = Array.from({ length: 10 }, () => randomBytes(10).toString('hex'));
  await db.$transaction(async tx => {
    if (challengeToken) await claimChallenge(tx, challengeToken, 'enroll', userId, user.authVersion);
    const claimed = await tx.user.updateMany({ where: { id: userId, active: true, role: 'ADMIN', mustChangePassword: false, authVersion: user.authVersion, mfaEnabled: false, mfaSecret: user.mfaSecret, lastTotpStep: { lt: step } }, data: { mfaEnabled: true, lastTotpStep: step, authVersion: { increment: 1 } } });
    if (!claimed.count) throw unauthorized();
    await tx.recoveryCode.deleteMany({ where: { userId } });
    await tx.recoveryCode.createMany({ data: recoveryCodes.map(code => ({ userId, codeHash: tokenHash(code) })) });
    await tx.refreshSession.updateMany({ where: { userId }, data: { revokedAt: new Date() } });
    await recordAudit({ actorId: userId, action: 'MFA_ENROLLED' }, tx);
  });
  return { recoveryCodes };
}
export async function verifyAdminFactor(userId: string, input: { totp?: string; recoveryCode?: string }, challengeToken?: string) {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.role !== 'ADMIN' || !user.active || !user.mfaEnabled || !user.mfaSecret || user.mustChangePassword) throw unauthorized();
  if (input.recoveryCode) {
    await db.$transaction(async tx => {
      if (challengeToken) await claimChallenge(tx, challengeToken, 'mfa', userId, user.authVersion);
      const claimed = await tx.recoveryCode.updateMany({ where: { userId, codeHash: tokenHash(input.recoveryCode!.trim().toLowerCase()), consumedAt: null, user: { active: true, role: 'ADMIN', mfaEnabled: true, mustChangePassword: false, authVersion: user.authVersion, mfaSecret: user.mfaSecret } }, data: { consumedAt: new Date() } });
      if (!claimed.count) throw new AppError('MFA', 400, 'Invalid or already used recovery code.');
      await tx.refreshSession.updateMany({ where: { userId }, data: { revokedAt: new Date() } });
      await recordAudit({ actorId: userId, action: 'MFA_RECOVERY_USED' }, tx);
    });
    return;
  }
  const step = validStep(user.mfaSecret, user.email, input.totp ?? '');
  await db.$transaction(async tx => {
    if (challengeToken) await claimChallenge(tx, challengeToken, 'mfa', userId, user.authVersion);
    const claimed = await tx.user.updateMany({ where: { id: userId, active: true, role: 'ADMIN', mustChangePassword: false, authVersion: user.authVersion, mfaSecret: user.mfaSecret, lastTotpStep: { lt: step }, mfaEnabled: true }, data: { lastTotpStep: step } });
    if (!claimed.count) throw new AppError('MFA', 400, 'This code is expired, already used, or the account has changed.');
  });
}
