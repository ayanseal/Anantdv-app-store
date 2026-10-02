import { cookies } from 'next/headers';
import { z } from 'zod';
import QRCode from 'qrcode';
import { db } from '@/server/db';
import { route, json, jsonBody, assertMutationOrigin, attachSession, clearCookies, sessionCookieOptions, requestIp, getRequestPrincipal } from '@/server/http';
import { login, changePassword, resolveChallenge, type LoginResult } from '@/server/auth/login';
import { beginEnrollment, finishEnrollment, verifyAdminFactor } from '@/server/auth/mfa';
import { admitAttempt } from '@/server/auth/throttle';
import { issueSession, rotateSession, logoutToken } from '@/server/auth/sessions';
import { tokenHash } from '@/server/auth/password';
import { recordAudit } from '@/server/audit';
import { unauthorized, AppError } from '@/server/errors';
type Context = { params: Promise<{ action: string }> };
function loginResponse(result: LoginResult) {
  if (result.kind === 'session') return attachSession(json({ kind: 'session' }), result.tokens);
  const response = json({ kind: result.kind });
  response.cookies.set('payana_challenge', result.challengeToken, { ...sessionCookieOptions(), maxAge: 600 });
  response.cookies.set('payana_access', '', { ...sessionCookieOptions(), maxAge: 0 });
  response.cookies.set('payana_refresh', '', { ...sessionCookieOptions(), maxAge: 0 });
  return response;
}
export async function GET(_request: Request, context: Context) {
  return route(async () => {
    const { action } = await context.params;
    if (action !== 'state') throw new AppError('NOT_FOUND', 404, 'Not found.');
    try { const principal = await getRequestPrincipal(); return json({ kind: 'session', role: principal.role }); } catch {}
    const token = (await cookies()).get('payana_challenge')?.value;
    if (token) {
      const challenge = await db.authChallenge.findUnique({ where: { tokenHash: tokenHash(token) } });
      if (challenge) { try { await resolveChallenge(token, challenge.purpose); return json({ kind: challenge.purpose }); } catch {} }
    }
    return json({ kind: 'login' });
  });
}
export async function POST(request: Request, context: Context) {
  return route(async () => {
    assertMutationOrigin(request);
    const { action } = await context.params;
    const jar = await cookies();
    if (action === 'refresh') {
      try { const token = jar.get('payana_refresh')?.value; if (!token) throw unauthorized(); return attachSession(json({ ok: true }), await rotateSession(token)); }
      catch { return clearCookies(json({ error: { code: 'UNAUTHORIZED', message: 'Your session has ended. Please sign in again.' } }, 401)); }
    }
    if (action === 'logout') { const token = jar.get('payana_refresh')?.value; if (token) await logoutToken(token); return clearCookies(json({ ok: true })); }
    if (action === 'login') {
      const input = z.object({ email: z.string().max(254), password: z.string().max(128) }).parse(await jsonBody(request));
      return loginResponse(await login(input.email, input.password, requestIp(request)));
    }
    const challenge = jar.get('payana_challenge')?.value;
    if (!challenge) throw unauthorized();
    if (action === 'password') {
      const input = z.object({ password: z.string().min(12).max(128) }).parse(await jsonBody(request));
      return loginResponse(await changePassword(challenge, input.password));
    }
    if (action === 'enrollment') {
      const user = await resolveChallenge(challenge, 'enroll');
      await admitAttempt(`enrollment:${user.id}`);
      const enrollment = await beginEnrollment(user.id, challenge);
      return json({ ...enrollment, qr: await QRCode.toDataURL(enrollment.otpauthUrl) });
    }
    if (action === 'enroll' || action === 'mfa') {
      const user = await resolveChallenge(challenge, action);
      const key = `factor:${user.id}`;
      await admitAttempt(key);
      const input = z.object({ code: z.string().max(64), recovery: z.boolean().default(false) }).parse(await jsonBody(request));
      let recoveryCodes: string[] | undefined;
      if (action === 'enroll') recoveryCodes = (await finishEnrollment(user.id, input.code, challenge)).recoveryCodes;
      else await verifyAdminFactor(user.id, input.recovery ? { recoveryCode: input.code } : { totp: input.code }, challenge);
      await recordAudit({ actorId: user.id, action: 'ADMIN_LOGIN' });
      return attachSession(json({ kind: 'session', role: 'ADMIN', recoveryCodes }), await issueSession(user.id, user.authVersion + (action === 'enroll' ? 1 : 0)));
    }
    throw new AppError('NOT_FOUND', 404, 'Not found.');
  });
}
