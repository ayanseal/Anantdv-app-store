import { afterEach, it, expect, vi } from 'vitest';
import { api } from '@/lib/api-client';
afterEach(() => vi.unstubAllGlobals());
it('coordinates concurrent expired requests into one refresh and retries each once', async () => {
  let refreshed = false; let refreshes = 0;
  // The HTTP boundary is the only double: assert returned values and actual refresh count.
  vi.stubGlobal('fetch', async (path: string) => {
    if (path === '/api/auth/refresh') { refreshes++; await new Promise(resolve => setTimeout(resolve, 20)); refreshed = true; return Response.json({ ok: true }); }
    if (path === '/api/auth/state') return Response.json({ kind: refreshed ? 'session' : 'login' });
    return refreshed ? Response.json({ value: path }) : Response.json({ error: { message: 'Expired' } }, { status: 401 });
  });
  expect(await Promise.all([api('/one'), api('/two')])).toEqual([{ value: '/one' }, { value: '/two' }]);
  expect(refreshes).toBe(1);
});
it('coordinates explicit refresh calls through the same shared lock', async () => {
  let refreshed = false; let refreshes = 0;
  let queue = Promise.resolve();
  // Model the browser's cross-tab lock boundary; the refresh implementation remains real.
  vi.stubGlobal('navigator', { locks: { request: (_name: string, work: () => Promise<unknown>) => { const next = queue.then(work); queue = next.then(() => undefined, () => undefined); return next; } } });
  vi.stubGlobal('fetch', async (path: string) => {
    if (path === '/api/auth/state') return Response.json({ kind: refreshed ? 'session' : 'login' });
    if (path === '/api/auth/refresh') { refreshes++; await new Promise(resolve => setTimeout(resolve, 20)); refreshed = true; return Response.json({ ok: true }); }
    throw new Error('Unexpected request');
  });
  await Promise.all([api('/api/auth/refresh', { method: 'POST' }), api('/api/auth/refresh', { method: 'POST' })]);
  expect(refreshes).toBe(1);
});
