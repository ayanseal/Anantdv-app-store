import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { ZodError } from 'zod';
import { getConfig } from '@/config/env';
import { AppError, unauthorized } from './errors';
import { principalFromAccess, type SessionTokens } from './auth/sessions';
// Derive the public origin per request so the same build works on any host.
function requestOrigin(request: Request) {
  const url = new URL(request.url);
  const trustProxy = getConfig().trustProxy;
  const protocol = (trustProxy ? request.headers.get('x-forwarded-proto') : null) ?? url.protocol.slice(0, -1);
  const host = (trustProxy ? request.headers.get('x-forwarded-host') : null) ?? request.headers.get('host') ?? url.host;
  if (!['http', 'https'].includes(protocol) || !host || /[\s,/@?#\\]/.test(host)) {
    throw new AppError('CSRF', 403, 'Invalid request origin.');
  }
  try {
    const origin = new URL(protocol + '://' + host);
    if (origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) throw new Error('Invalid host');
    return origin;
  } catch {
    throw new AppError('CSRF', 403, 'Invalid request origin.');
  }
}
export function assertMutationOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin || request.headers.get('sec-fetch-site') === 'cross-site' || origin !== requestOrigin(request).origin) {
    throw new AppError('CSRF', 403, 'Invalid request origin.');
  }
}
export function sessionCookieOptions(request: Request) {
  return {
    httpOnly: true,
    secure: requestOrigin(request).protocol === 'https:',
    sameSite: 'strict' as const,
    path: '/'
  };
}
export function attachSession(response: NextResponse, tokens: SessionTokens, request: Request) {
  const options = sessionCookieOptions(request);
  response.cookies.set('payana_access', tokens.accessToken, { ...options, maxAge: tokens.accessSeconds });
  response.cookies.set('payana_refresh', tokens.refreshToken, { ...options, maxAge: tokens.refreshSeconds });
  response.cookies.set('payana_challenge', '', { ...options, maxAge: 0 });
  return response;
}
export function clearCookies(response: NextResponse, request: Request) {
  const options = sessionCookieOptions(request);
  for (const name of ['payana_access', 'payana_refresh', 'payana_challenge']) response.cookies.set(name, '', { ...options, maxAge: 0 });
  return response;
}
export async function getRequestPrincipal() {
  const token = (await cookies()).get('payana_access')?.value;
  if (!token) throw unauthorized();
  return principalFromAccess(token);
}
export async function jsonBody(request: Request) {
  const tooLarge = () => new AppError('TOO_LARGE', 413, 'Request is too large.');
  if (Number(request.headers.get('content-length')) > 65536) { await request.body?.cancel().catch(() => {}); throw tooLarge(); }
  if (!request.body) throw new AppError('VALIDATION', 400, 'Invalid JSON request.');
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 65536) { await reader.cancel().catch(() => {}); throw tooLarge(); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const text = Buffer.concat(chunks).toString('utf8');
  try { return JSON.parse(text); } catch { throw new AppError('VALIDATION', 400, 'Invalid JSON request.'); }
}
export function json(value: unknown, status = 200) { return NextResponse.json(value, { status, headers: { 'Cache-Control': 'private, no-store' } }); }
export async function route(handler: () => Promise<Response>) {
  try { return await handler(); }
  catch (error) {
    if (error instanceof AppError) return json({ error: { code: error.code, message: error.message } }, error.status);
    if (error instanceof ZodError) return json({ error: { code: 'VALIDATION', message: error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ') } }, 400);
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') return json({ error: { code: 'CONFLICT', message: 'This email, slug, or version already exists.' } }, 409);
    console.error('Request failed:', error);
    const message = error instanceof Error ? error.message : 'The request could not be completed.';
    return json({ error: { code: 'INTERNAL', message: process.env.NODE_ENV === 'production' ? 'The request could not be completed.' : message } }, 500);
  }
}
export function requestIp(request: Request) { return getConfig().trustProxy ? (request.headers.get('x-forwarded-for')?.split(',')[0].trim().slice(0, 80) || 'unknown') : 'local'; }
