import { z } from 'zod';
import { db } from '@/server/db';
import { loadPrincipal, requireAdmin, requireAdminOrViewer, type Principal } from '@/server/auth/principal';
import { hashPassword, temporaryPassword } from '@/server/auth/password';
import { recordAudit } from '@/server/audit';
import { AppError } from '@/server/errors';
export const userInput = z.object({ id: z.string().optional(), email: z.string().trim().toLowerCase().max(254).pipe(z.email()), name: z.string().trim().min(1).max(100), role: z.enum(['ADMIN', 'CUSTOMER', 'VIEWER']), companyId: z.string().nullable().default(null), active: z.boolean() });
export type UserInput = z.input<typeof userInput>;
export const publicUserSelect = { id: true, email: true, name: true, role: true, companyId: true, active: true, mustChangePassword: true, mfaEnabled: true, createdAt: true, company: { select: { name: true } } } as const;
export async function listUsers(actor: Principal) { requireAdminOrViewer(await loadPrincipal(actor.id)); return db.user.findMany({ select: publicUserSelect, orderBy: { createdAt: 'desc' } }); }
export async function saveUser(actor: Principal, raw: UserInput) {
  requireAdmin(await loadPrincipal(actor.id));
  const input = userInput.parse(raw);
  if (input.role === 'CUSTOMER' && !input.companyId) throw new AppError('VALIDATION', 400, 'Customers must belong to a company.');
  const companyId = input.role === 'CUSTOMER' ? input.companyId : null;
  const password = input.id ? null : temporaryPassword();
  const passwordHash = password ? await hashPassword(password) : null;
  return db.$transaction(async tx => {
    if (companyId && !await tx.company.findUnique({ where: { id: companyId } })) throw new AppError('VALIDATION', 400, 'Company does not exist.');
    const existing = input.id ? await tx.user.findUniqueOrThrow({ where: { id: input.id } }) : null;
    if (existing?.active && existing.role === 'ADMIN' && (!input.active || input.role !== 'ADMIN') && await tx.user.count({ where: { role: 'ADMIN', active: true } }) <= 1) throw new AppError('LAST_ADMIN', 400, 'The last active administrator cannot be disabled or demoted.');
    const changedSecurity = existing && (existing.role !== input.role || existing.companyId !== companyId || existing.active !== input.active || existing.email !== input.email);
    const data = { email: input.email, name: input.name, role: input.role, companyId, active: input.active };
    const user = existing ? await tx.user.update({ where: { id: existing.id }, data: { ...data, ...(changedSecurity ? { authVersion: { increment: 1 } } : {}), ...(existing.role !== input.role ? { mfaEnabled: false, mfaSecret: null, lastTotpStep: 0n } : {}) }, select: publicUserSelect }) : await tx.user.create({ data: { ...data, passwordHash: passwordHash! }, select: publicUserSelect });
    if (changedSecurity) {
      await tx.refreshSession.updateMany({ where: { userId: user.id }, data: { revokedAt: new Date() } });
      await tx.authChallenge.updateMany({ where: { userId: user.id }, data: { usedAt: new Date() } });
      if (existing.role !== input.role) await tx.recoveryCode.deleteMany({ where: { userId: user.id } });
    }
    await recordAudit({ actorId: actor.id, action: existing ? 'USER_UPDATED' : 'USER_CREATED', targetId: user.id, metadata: { role: user.role, companyId, active: user.active } }, tx);
    return { user, temporaryPassword: password };
  });
}
export async function resetUserPassword(actor: Principal, userId: string) {
  requireAdmin(await loadPrincipal(actor.id));
  const password = temporaryPassword();
  const passwordHash = await hashPassword(password);
  await db.$transaction(async tx => {
    await tx.user.update({ where: { id: userId }, data: { passwordHash, mustChangePassword: true, authVersion: { increment: 1 } } });
    await tx.refreshSession.updateMany({ where: { userId }, data: { revokedAt: new Date() } });
    await tx.authChallenge.updateMany({ where: { userId }, data: { usedAt: new Date() } });
    await recordAudit({ actorId: actor.id, action: 'PASSWORD_RESET', targetId: userId }, tx);
  });
  return { temporaryPassword: password };
}
export async function resetUserMfa(actor: Principal, userId: string) {
  requireAdmin(await loadPrincipal(actor.id));
  if (actor.id === userId) throw new AppError('VALIDATION', 400, 'Use a recovery code to access your account; another administrator can reset your authenticator.');
  await db.$transaction(async tx => {
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    if (user.role !== 'ADMIN') throw new AppError('VALIDATION', 400, 'Only administrators use MFA.');
    await tx.user.update({ where: { id: userId }, data: { mfaEnabled: false, mfaSecret: null, lastTotpStep: 0n, authVersion: { increment: 1 } } });
    await tx.recoveryCode.deleteMany({ where: { userId } });
    await tx.refreshSession.updateMany({ where: { userId }, data: { revokedAt: new Date() } });
    await tx.authChallenge.updateMany({ where: { userId }, data: { usedAt: new Date() } });
    await recordAudit({ actorId: actor.id, action: 'MFA_RESET', targetId: userId }, tx);
  });
}
