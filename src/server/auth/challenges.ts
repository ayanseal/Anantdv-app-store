import { db } from '@/server/db';
import type { Prisma } from '@/generated/prisma/client';
import { opaqueToken, tokenHash } from './password';
import { unauthorized } from '@/server/errors';
export type ChallengePurpose = 'password' | 'mfa' | 'enroll';
function validUser(user: { active: boolean; role: string; mustChangePassword: boolean; mfaEnabled: boolean; company: { active: boolean } | null }, purpose: string) {
  return user.active && (user.role !== 'CUSTOMER' || !!user.company?.active) && (purpose === 'password' ? user.mustChangePassword : !user.mustChangePassword && user.role === 'ADMIN' && (purpose === 'mfa' ? user.mfaEnabled : !user.mfaEnabled));
}
export async function createChallenge(userId: string, purpose: ChallengePurpose, expectedAuthVersion: number) {
  const token = opaqueToken();
  await db.$transaction(async tx => {
    const user = await tx.user.findUnique({ where: { id: userId }, include: { company: true } });
    if (!user || user.authVersion !== expectedAuthVersion || !validUser(user, purpose)) throw unauthorized();
    await tx.authChallenge.create({ data: { userId, purpose, authVersion: expectedAuthVersion, tokenHash: tokenHash(token), expiresAt: new Date(Date.now() + 600000) } });
  });
  return token;
}
export async function resolveChallenge(token: string, purpose: string) {
  const challenge = await db.authChallenge.findUnique({ where: { tokenHash: tokenHash(token) }, include: { user: { include: { company: true } } } });
  if (!challenge || challenge.usedAt || challenge.expiresAt <= new Date() || challenge.purpose !== purpose || challenge.authVersion !== challenge.user.authVersion || !validUser(challenge.user, purpose)) throw unauthorized();
  return challenge.user;
}
export async function claimChallenge(tx: Prisma.TransactionClient, token: string, purpose: ChallengePurpose, userId: string, expectedAuthVersion: number) {
  const user = await tx.user.findUnique({ where: { id: userId }, include: { company: true } });
  if (!user || user.authVersion !== expectedAuthVersion || !validUser(user, purpose)) throw unauthorized();
  const claimed = await tx.authChallenge.updateMany({ where: { userId, tokenHash: tokenHash(token), purpose, authVersion: expectedAuthVersion, usedAt: null, expiresAt: { gt: new Date() } }, data: { usedAt: new Date() } });
  if (!claimed.count) throw unauthorized();
}
