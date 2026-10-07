import { afterEach, beforeEach, it, expect, vi } from 'vitest';
import { assertMutationOrigin, sessionCookieOptions, jsonBody } from '@/server/http';
import { checkThrottle, registerAttempt, admitAttempt } from '@/server/auth/throttle';
import { resetDb } from './helpers';
beforeEach(resetDb);
afterEach(() => vi.unstubAllEnvs());
import { requestIp } from '@/server/http';

it('allows requests behind Nginx without extra proxy protection layer', () => {
  expect(() => assertMutationOrigin(new Request('http://localhost:3000/api/auth/login', { method: 'POST' }))).not.toThrow();
  expect(() => assertMutationOrigin(new Request('http://localhost:3000/api/auth/login', { method: 'POST', headers: { origin: 'https://evil.example' } }))).not.toThrow();
  expect(() => assertMutationOrigin(new Request('http://localhost:3000/api/auth/login', { method: 'POST', headers: { origin: 'http://localhost:3000' } }))).not.toThrow();
  expect(() => assertMutationOrigin(new Request('http://192.168.1.15:3000/api/auth/login', { method: 'POST', headers: { origin: 'http://192.168.1.15:3000', host: '192.168.1.15:3000' } }))).not.toThrow();
});

it.each(['http://localhost:3000', 'http://192.168.1.15:3000', 'https://store.example', 'http://[::1]:3000'])('configures session cookies appropriately for %s', origin => {
  const isHttps = origin.startsWith('https:');
  const request = new Request(`${origin}/api/auth/login`, { headers: { origin, ...(isHttps ? { 'x-forwarded-proto': 'https' } : {}) } });
  expect(sessionCookieOptions(request)).toMatchObject({ secure: isHttps, httpOnly: true, sameSite: 'lax', path: '/' });
});

it('detects HTTPS from x-forwarded-proto behind Nginx', () => {
  const request = new Request('http://localhost:3000/api', { headers: { 'x-forwarded-proto': 'https', host: 'store.example' } });
  expect(sessionCookieOptions(request).secure).toBe(true);
});

it('detects HTTPS from origin header behind Nginx', () => {
  const request = new Request('http://localhost:3000/api', { headers: { origin: 'https://store.example' } });
  expect(sessionCookieOptions(request).secure).toBe(true);
});

it('extracts client IP from x-forwarded-for and x-real-ip behind proxy', () => {
  const req1 = new Request('http://localhost:3000/api', { headers: { 'x-forwarded-for': '203.0.113.195, 192.168.1.1' } });
  expect(requestIp(req1)).toBe('203.0.113.195');

  const req2 = new Request('http://localhost:3000/api', { headers: { 'x-real-ip': '198.51.100.4' } });
  expect(requestIp(req2)).toBe('198.51.100.4');

  const req3 = new Request('http://localhost:3000/api');
  expect(requestIp(req3)).toBe('local');
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
