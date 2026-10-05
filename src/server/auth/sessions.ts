import { randomUUID } from 'node:crypto';
import { db } from '@/server/db';
import { getConfig } from '@/config/env';
import { opaqueToken, tokenHash } from './password';
import { loadPrincipal } from './principal';
import { signAccess, readAccess } from './tokens';
import { unauthorized } from '@/server/errors';
import { recordAudit } from '@/server/audit';
export type SessionTokens = { accessToken: string; refreshToken: string; accessSeconds: number; refreshSeconds: number };
export async function issueSession(userId: string, expectedAuthVersion?: number): Promise<SessionTokens> {
  const config = getConfig();
  const refreshToken = opaqueToken();
  const family = randomUUID();
  const user = await db.$transaction(async tx => {
    const current = await tx.user.findUnique({ where: { id: userId }, include: { company: true } });
    if (!current?.active || current.mustChangePassword || (current.role === 'CUSTOMER' && !current.company?.active) || (expectedAuthVersion !== undefined && expectedAuthVersion !== current.authVersion)) throw unauthorized();
    await tx.refreshSession.create({ data: { userId, family, authVersion: current.authVersion, tokenHash: tokenHash(refreshToken), expiresAt: new Date(Date.now() + config.refreshTokenSeconds * 1000) } });
    return current;
  });
  return { accessToken: await signAccess(userId, family, user.authVersion), refreshToken, accessSeconds: config.accessTokenSeconds, refreshSeconds: config.refreshTokenSeconds };
}
export async function rotateSession(refreshToken: string): Promise<SessionTokens> {
  const config = getConfig();
  const nextToken = opaqueToken();
  const result = await db.$transaction(async tx => {
    const old = await tx.refreshSession.findUnique({ where: { tokenHash: tokenHash(refreshToken) }, include: { user: { include: { company: true } } } });
    if (!old || old.revokedAt || old.expiresAt <= new Date()) return null;
    if (old.consumedAt) {
      await tx.refreshSession.updateMany({ where: { family: old.family }, data: { revokedAt: new Date() } });
      await recordAudit({ actorId: old.userId, action: 'REFRESH_REUSE', metadata: { reason: 'Consumed token reused' } }, tx);
      return null;
    }
    const user = old.user;
    if (!user.active || user.authVersion !== old.authVersion || user.mustChangePassword || (user.role === 'CUSTOMER' && !user.company?.active)) return null;
    const claim = await tx.refreshSession.updateMany({ where: { id: old.id, consumedAt: null, revokedAt: null }, data: { consumedAt: new Date() } });
    if (claim.count !== 1) return null;
    await tx.refreshSession.create({ data: { userId: old.userId, family: old.family, authVersion: user.authVersion, tokenHash: tokenHash(nextToken), expiresAt: old.expiresAt } });
    return { userId: old.userId, family: old.family, authVersion: user.authVersion, expiry: old.expiresAt };
  });
  if (!result) throw unauthorized();
  return { accessToken: await signAccess(result.userId, result.family, result.authVersion), refreshToken: nextToken, accessSeconds: config.accessTokenSeconds, refreshSeconds: Math.max(1, Math.floor((result.expiry.getTime() - Date.now()) / 1000)) };
}
export async function principalFromAccess(token: string) {
  const payload = await readAccess(token);
  const principal = await loadPrincipal(payload.userId);
  if (principal.authVersion !== payload.authVersion) throw unauthorized();
  const live = await db.refreshSession.findFirst({ where: { userId: principal.id, family: payload.family, revokedAt: null, consumedAt: null, expiresAt: { gt: new Date() } } });
  if (!live) throw unauthorized();
  return principal;
}
export async function revokeSessions(userId: string) {
  await db.$transaction([
    db.refreshSession.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }),
    db.authChallenge.updateMany({ where: { userId, usedAt: null }, data: { usedAt: new Date() } }),
  ]);
}
export async function logoutToken(refreshToken: string) {
  const session = await db.refreshSession.findUnique({ where: { tokenHash: tokenHash(refreshToken) } });
  if (session) await db.refreshSession.updateMany({ where: { family: session.family }, data: { revokedAt: new Date() } });
}
