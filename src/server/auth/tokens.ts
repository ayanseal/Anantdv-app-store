import { SignJWT, jwtVerify } from 'jose';
import { getConfig } from '@/config/env';
import { unauthorized } from '@/server/errors';
export async function signAccess(userId: string, family: string, authVersion: number) {
  const config = getConfig();
  return new SignJWT({ family, authVersion }).setProtectedHeader({ alg: 'HS256', typ: 'JWT' }).setSubject(userId).setIssuer('payana').setAudience('payana-portal').setIssuedAt().setExpirationTime(`${config.accessTokenSeconds}s`).sign(new TextEncoder().encode(config.tokenSecret));
}
export async function readAccess(token: string) {
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(getConfig().tokenSecret), { algorithms: ['HS256'], issuer: 'payana', audience: 'payana-portal' });
    if (!payload.sub || typeof payload.family !== 'string' || typeof payload.authVersion !== 'number') throw unauthorized();
    return { userId: payload.sub, family: payload.family, authVersion: payload.authVersion };
  } catch { throw unauthorized(); }
}
