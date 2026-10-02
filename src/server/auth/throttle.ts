import { db } from '@/server/db';
import { AppError } from '@/server/errors';
export async function checkThrottle(key: string) {
  const record = await db.loginThrottle.findUnique({ where: { key } });
  if (record && record.expiresAt > new Date() && record.attempts >= 10) throw new AppError('RATE_LIMITED', 429, 'Too many attempts. Try again in 15 minutes.');
}
export async function registerAttempt(key: string) {
  const expiry = new Date(Date.now() + 15 * 60 * 1000);
  await db.$transaction(async tx => {
    await tx.loginThrottle.deleteMany({ where: { key, expiresAt: { lte: new Date() } } });
    await tx.loginThrottle.upsert({ where: { key }, create: { key, attempts: 1, expiresAt: expiry }, update: { attempts: { increment: 1 } } });
  });
}
export async function admitAttempt(key: string, ceiling = 10) {
  const admitted = await db.$transaction(async tx => {
    await tx.loginThrottle.deleteMany({ where: { key, expiresAt: { lte: new Date() } } });
    await tx.loginThrottle.upsert({ where: { key }, create: { key, attempts: 0, expiresAt: new Date(Date.now() + 15 * 60 * 1000) }, update: {} });
    const claimed = await tx.loginThrottle.updateMany({ where: { key, attempts: { lt: ceiling } }, data: { attempts: { increment: 1 } } });
    return claimed.count === 1;
  });
  if (!admitted) throw new AppError('RATE_LIMITED', 429, 'Too many attempts. Try again in 15 minutes.');
}
