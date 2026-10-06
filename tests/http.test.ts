import { afterEach, beforeEach, it, expect, vi } from 'vitest';
import { assertMutationOrigin, sessionCookieOptions, jsonBody } from '@/server/http';
import { checkThrottle, registerAttempt, admitAttempt } from '@/server/auth/throttle';
import { resetDb } from './helpers';
beforeEach(resetDb);
afterEach(() => vi.unstubAllEnvs());
it('rejects missing and foreign mutation origins', () => {
  expect(() => assertMutationOrigin(new Request('http://localhost:3000/api/auth/login', { method: 'POST' }))).toThrow();
  expect(() => assertMutationOrigin(new Request('http://localhost:3000/api/auth/login', { method: 'POST', headers: { origin: 'https://evil.example' } }))).toThrow();
  expect(() => assertMutationOrigin(new Request('http://localhost:3000/api/auth/login', { method: 'POST', headers: { origin: 'http://localhost:3000' } }))).not.toThrow();
  expect(() => assertMutationOrigin(new Request('http://192.168.1.15:3000/api/auth/login', { method: 'POST', headers: { origin: 'http://192.168.1.15:3000', host: '192.168.1.15:3000' } }))).not.toThrow();
});
it.each(['http://localhost:3000', 'http://192.168.1.15:3000', 'https://store.example', 'http://[::1]:3000'])('supports the current origin %s in production', origin => {
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('TRUST_PROXY', origin.startsWith('https:') ? 'true' : 'false');
  const request = new Request(`${origin}/api/auth/login`, { headers: { origin } });
  expect(() => assertMutationOrigin(request)).not.toThrow();
  expect(sessionCookieOptions(request)).toMatchObject({ secure: origin.startsWith('https:'), httpOnly: true, sameSite: 'strict', path: '/' });
});
it.each(['http://localhost:4000', 'https://localhost:3000', 'http://192.168.1.20:3000', 'null', 'http://localhost:3000/path'])('rejects a different or invalid origin %s', origin => {
  expect(() => assertMutationOrigin(new Request('http://localhost:3000/api', { headers: { origin } }))).toThrow();
});
it('rejects missing origins and explicitly cross-site requests even on the same host', () => {
  expect(() => assertMutationOrigin(new Request('http://localhost:3000/api'))).toThrow();
  expect(() => assertMutationOrigin(new Request('http://localhost:3000/api', { headers: { origin: 'http://localhost:3000', 'sec-fetch-site': 'cross-site' } }))).toThrow();
});
it('uses the host header for a directly accessed alternate hostname', () => {
  const request = new Request('http://localhost:3000/api', { headers: { host: 'store.local:3000', origin: 'http://store.local:3000' } });
  expect(() => assertMutationOrigin(request)).not.toThrow();
});
it('honors forwarded host and protocol only behind a trusted proxy', () => {
  const request = new Request('http://localhost:3000/api', { headers: { host: 'localhost:3000', origin: 'https://store.example', 'x-forwarded-host': 'store.example', 'x-forwarded-proto': 'https' } });
  vi.stubEnv('TRUST_PROXY', 'false');
  expect(() => assertMutationOrigin(request)).toThrow();
  expect(sessionCookieOptions(request).secure).toBe(false);
  vi.stubEnv('TRUST_PROXY', 'true');
  expect(() => assertMutationOrigin(request)).not.toThrow();
  expect(sessionCookieOptions(request).secure).toBe(true);
});
it('ignores a protocol already rewritten by Next from an untrusted forwarded header', () => {
  vi.stubEnv('TRUST_PROXY', 'false');
  const request = new Request('https://localhost:3000/api', { headers: { host: 'localhost:3000', origin: 'http://localhost:3000', 'x-forwarded-proto': 'https' } });
  expect(() => assertMutationOrigin(request)).not.toThrow();
  expect(sessionCookieOptions(request).secure).toBe(false);
});
it.each(['https,http', 'ftp'])('rejects invalid forwarded protocols %s', protocol => {
  vi.stubEnv('TRUST_PROXY', 'true');
  const request = new Request('http://localhost:3000/api', { headers: { origin: 'https://store.example', 'x-forwarded-host': 'store.example', 'x-forwarded-proto': protocol } });
  expect(() => assertMutationOrigin(request)).toThrow();
});
it('persists login throttling after repeated attempts', async () => {
  for (let i = 0; i < 10; i++) await registerAttempt('account:test@example.com');
  await expect(checkThrottle('account:test@example.com')).rejects.toThrow();
});
it('admits only ten attempts from a concurrent batch', async () => {
  const results = await Promise.allSettled(Array.from({ length: 20 }, () => admitAttempt('factor:test')));
  expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(10);
});
it('cancels an unknown-length JSON stream before buffering its oversized tail', async () => {
  const stream = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(65537)); }, pull(controller) { controller.error(new Error('Read past limit')); } });
  const request = new Request('http://localhost:3000/api/auth/login', { method: 'POST', body: stream, duplex: 'half' } as RequestInit);
  await expect(jsonBody(request)).rejects.toMatchObject({ code: 'TOO_LARGE', status: 413 });
});
