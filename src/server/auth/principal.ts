import { db } from '@/server/db';
import { forbidden, unauthorized } from '@/server/errors';
export type Principal = { id: string; role: 'ADMIN' | 'CUSTOMER' | 'VIEWER'; companyId: string | null; name: string; email: string; companyName: string | null; authVersion: number };

export function isMfaDisabled(): boolean {
  if (process.env.NODE_ENV === 'test') {
    return process.env.DISABLE_MFA === 'true';
  }
  return true;
}

export async function loadPrincipal(userId: string): Promise<Principal> {
  const user = await db.user.findUnique({ where: { id: userId }, include: { company: true } });
  if (!user?.active || user.mustChangePassword || (user.role === 'ADMIN' && !user.mfaEnabled && !isMfaDisabled()) || (user.role === 'CUSTOMER' && !user.company?.active)) throw unauthorized();
  return { id: user.id, role: user.role, companyId: user.companyId, name: user.name, email: user.email, companyName: user.company?.name ?? null, authVersion: user.authVersion };
}
export function requireAdmin(principal: Principal) { if (principal.role !== 'ADMIN') throw forbidden(); }
export function requireAdminOrViewer(principal: Principal) { if (principal.role !== 'ADMIN' && principal.role !== 'VIEWER') throw forbidden(); }
export async function requireAppAccess(principal: Principal, appId: string, _intent: 'browse' | 'download' = 'browse') {
  const current = await loadPrincipal(principal.id);
  if (current.role === 'ADMIN' || current.role === 'VIEWER') return;
  const app = await db.app.findUnique({ where: { id: appId }, include: { assignments: { where: { companyId: current.companyId ?? '' } } } });
  if (!app || !app.active || (current.role === 'CUSTOMER' && !app.assignments.length)) throw forbidden();
}
