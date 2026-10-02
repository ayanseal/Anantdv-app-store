import { beforeEach, it, expect } from 'vitest';
import { assertMutationOrigin, sessionCookieOptions, jsonBody } from '@/server/http';
import { checkThrottle, registerAttempt, admitAttempt } from '@/server/auth/throttle';
import { resetDb } from './helpers';
beforeEach(resetDb);
it('rejects missing and foreign mutation origins', () => {
  expect(() => assertMutationOrigin(new Request('http://localhost:3000/api/auth/login', { method: 'POST' }))).toThrow();
  expect(() => assertMutationOrigin(new Request('http://localhost:3000/api/auth/login', { method: 'POST', headers: { origin: 'https://evil.example' } }))).toThrow();
  expect(() => assertMutationOrigin(new Request('http://localhost:3000/api/auth/login', { method: 'POST', headers: { origin: 'http://localhost:3000' } }))).not.toThrow();
});
it('uses HttpOnly secure production cookies', () => {
  expect(sessionCookieOptions(true)).toMatchObject({ secure: true, httpOnly: true, sameSite: 'strict', path: '/' });
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
