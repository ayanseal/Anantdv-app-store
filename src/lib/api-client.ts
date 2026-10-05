'use client';
let refreshPromise: Promise<boolean> | null = null;
export async function refreshSession() {
  const renew = async () => {
    const state = await fetch('/api/auth/state', { credentials: 'same-origin', cache: 'no-store' });
    if (state.ok && (await state.json()).kind === 'session') return true;
    return (await fetch('/api/auth/refresh', { method: 'POST', credentials: 'same-origin' })).ok;
  };
  if (!refreshPromise) {
    const work = () =>
      typeof navigator !== 'undefined' &&
      (typeof window !== 'undefined' ? window.isSecureContext : false) &&
      navigator.locks
        ? navigator.locks.request('payana-session-refresh', renew)
        : renew();
    refreshPromise = work().finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
}
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (path === '/api/auth/refresh') {
    if (!await refreshSession()) throw new Error('Your session has ended. Please sign in again.');
    return { ok: true } as T;
  }
  const request = () => fetch(path, { ...options, credentials: 'same-origin', headers: { ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), ...options.headers } });
  let response = await request();
  if (response.status === 401 && !path.startsWith('/api/auth/') && await refreshSession()) response = await request();
  const result = await response.json().catch(() => { throw new Error('The server could not complete this request. Please try again.'); });
  if (!response.ok) throw new Error(result.error?.message || 'The request failed.');
  return result as T;
}
