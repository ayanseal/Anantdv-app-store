import { describe, it, expect } from 'vitest';
import { parseConfig } from '@/config/env';
const env = { APP_ORIGIN: 'http://localhost:3000', DATABASE_URL: 'file:./data/dev.db', TOKEN_SECRET: 's'.repeat(48), MFA_ENCRYPTION_KEY: 'ab'.repeat(32) };
describe('environment validation', () => {
  it('supplies bounded session and upload defaults', () => {
    const config = parseConfig(env);
    expect(config.accessTokenSeconds).toBe(900);
    expect(config.refreshTokenSeconds).toBe(604800);
    expect(config.uploadMaxBytes).toBe(262144000);
  });
  it.each([{ TOKEN_SECRET: '' }, { MFA_ENCRYPTION_KEY: 'bad' }, { UPLOAD_MAX_MB: '-1' }, { APP_ORIGIN: 'javascript:alert(1)' }, { DATABASE_URL: 'postgres://remote' }])('rejects unsafe configuration %j', changes => {
    expect(() => parseConfig({ ...env, ...changes })).toThrow();
  });
  it('requires HTTPS in production', () => expect(() => parseConfig({ ...env, NODE_ENV: 'production' })).toThrow());
  it('rejects upload directories inside public', () => expect(() => parseConfig({ ...env, UPLOAD_DIR: './public/files' })).toThrow());
});
