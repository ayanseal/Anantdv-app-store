import { scrypt, randomBytes, timingSafeEqual, createHash } from 'node:crypto';
import { AppError } from '@/server/errors';
const derive = (password: string, salt: string) => new Promise<Buffer>((resolve, reject) => scrypt(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (error, key) => error ? reject(error) : resolve(key)));
export function validatePassword(value: string) {
  if (value.length < 12 || value.length > 128) throw new AppError('VALIDATION', 400, 'Use a password between 12 and 128 characters.');
}
export async function hashPassword(value: string) {
  validatePassword(value);
  const salt = randomBytes(16).toString('hex');
  return `scrypt:${salt}:${(await derive(value, salt)).toString('hex')}`;
}
export async function verifyPassword(value: string, hash: string) {
  if (value.length > 128) return false;
  const [algorithm, salt, encoded] = hash.split(':');
  if (algorithm !== 'scrypt' || !salt || !encoded) return false;
  const key = await derive(value, salt);
  const expected = Buffer.from(encoded, 'hex');
  return expected.length === key.length && timingSafeEqual(expected, key);
}
export const opaqueToken = () => randomBytes(32).toString('base64url');
export const tokenHash = (value: string) => createHash('sha256').update(value).digest('hex');
export const temporaryPassword = () => randomBytes(18).toString('base64url');
