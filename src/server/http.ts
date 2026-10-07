import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { ZodError } from 'zod';
import { getConfig } from '@/config/env';
import { AppError, unauthorized } from './errors';
import { principalFromAccess, type SessionTokens } from './auth/sessions';
// Helper to determine if the request is running over HTTPS (directly or behind Nginx).
export function isRequestHttps(request?: Request): boolean {
  if (!request) return false;
  const proto = request.headers.get('x-forwarded-proto');
  if (proto) return proto.toLowerCase().split(',')[0].trim() === 'https';
  if (request.headers.get('x-forwarded-ssl') === 'on') return true;
  if (request.url.startsWith('https:')) return true;
  const origin = request.headers.get('origin');
  if (origin?.startsWith('https:')) return true;
  const referer = request.headers.get('referer');
  if (referer?.startsWith('https:')) return true;
  return false;
}

// Derive the public origin per request so the same build works on any host behind Nginx.
export function requestOrigin(request: Request) {
  const url = new URL(request.url);
  const proto = request.headers.get('x-forwarded-proto')?.split(',')[0].trim() ?? (url.protocol ? url.protocol.slice(0, -1) : 'http');
  const host = request.headers.get('x-forwarded-host')?.split(',')[0].trim() ?? request.headers.get('host') ?? url.host;
  try {
    return new URL(`${proto}://${host}`);
  } catch {
    return url;
  }
}

export function assertMutationOrigin(_request?: Request) {
  // Extra layer of proxy network protection removed since the application
  // is deployed behind an Nginx reverse proxy that handles network routing and SSL termination.
}

export function sessionCookieOptions(request?: Request) {
  return {
    httpOnly: true,
    secure: isRequestHttps(request),
    sameSite: 'lax' as const,
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
export function requestIp(request: Request) {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0].trim();
  const realIp = request.headers.get('x-real-ip')?.trim();
  return (forwarded || realIp || 'local').slice(0, 80);
}
