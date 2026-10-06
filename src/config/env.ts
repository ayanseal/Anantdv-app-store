import { z } from 'zod';
import path from 'node:path';
const schema = z.object({
  DATABASE_URL: z.string().startsWith('file:').min(6),
  UPLOAD_DIR: z.string().default('./data/uploads'),
  UPLOAD_MAX_MB: z.coerce.number().int().min(1).max(1024).default(250),
  UPLOAD_EXTENSIONS: z.string().default('apk,aab,ipa,exe,msi,dmg,pkg,zip,tar.gz'),
  TOKEN_SECRET: z.string().min(32),
  MFA_ENCRYPTION_KEY: z.string().regex(/^[a-fA-F0-9]{64}$/),
  ACCESS_TOKEN_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
  REFRESH_TOKEN_SECONDS: z.coerce.number().int().min(3600).max(2592000).default(604800),
  NODE_ENV: z.string().optional(),
  TRUST_PROXY: z.enum(['true', 'false']).default('false'),
});
export function parseConfig(env: Record<string, string | undefined>) {
  const value = schema.parse(env);
  const uploadDir = path.resolve(value.UPLOAD_DIR);
  const publicDir = path.resolve('public');
  const relative = path.relative(publicDir, uploadDir);
  if (!relative || (!relative.startsWith('..') && !path.isAbsolute(relative))) throw new Error('Uploads must be outside public');
  const extensions = value.UPLOAD_EXTENSIONS.split(',').map(e => e.trim().toLowerCase());
  if (!extensions.length || extensions.some(e => !/^[a-z0-9]+(?:\.[a-z0-9]+)*$/.test(e))) throw new Error('Invalid upload extensions');
  return {
    databaseUrl: `file:${path.resolve(value.DATABASE_URL.slice(5)).replaceAll('\\', '/')}`,
    uploadDir, uploadMaxBytes: value.UPLOAD_MAX_MB * 1024 * 1024, extensions,
    tokenSecret: value.TOKEN_SECRET, mfaEncryptionKey: value.MFA_ENCRYPTION_KEY,
    accessTokenSeconds: value.ACCESS_TOKEN_SECONDS, refreshTokenSeconds: value.REFRESH_TOKEN_SECONDS,
    production: value.NODE_ENV === 'production', trustProxy: value.TRUST_PROXY === 'true',
  };
}
export const getConfig = () => parseConfig(process.env);
export type Config = ReturnType<typeof parseConfig>;
