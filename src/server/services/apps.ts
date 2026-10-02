import { z } from 'zod';
import { db } from '@/server/db';
import { loadPrincipal, requireAdmin, requireAppAccess, type Principal } from '@/server/auth/principal';
import { recordAudit } from '@/server/audit';
import { AppError } from '@/server/errors';
export const appInput = z.object({ id: z.string().optional(), name: z.string().trim().min(1).max(100), slug: z.string().trim().min(1).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), description: z.string().trim().max(3000), platform: z.enum(['Android', 'iOS', 'Windows', 'macOS', 'Linux', 'Other']), active: z.boolean() });
export type AppInput = z.infer<typeof appInput>;
export const releaseSelect = { id: true, version: true, notes: true, filename: true, size: true, checksum: true, published: true, publishedAt: true, createdAt: true } as const;
export async function saveApp(actor: Principal, raw: AppInput) {
  requireAdmin(await loadPrincipal(actor.id));
  const { id, ...input } = appInput.parse(raw);
  return db.$transaction(async tx => {
    const app = id ? await tx.app.update({ where: { id }, data: input }) : await tx.app.create({ data: input });
    await recordAudit({ actorId: actor.id, action: id ? 'APP_UPDATED' : 'APP_CREATED', targetId: app.id, metadata: { active: app.active } }, tx);
    return app;
  });
}
export async function setCompanyApps(actor: Principal, companyId: string, appIds: string[]) {
  requireAdmin(await loadPrincipal(actor.id));
  const ids = [...new Set(z.array(z.string().min(1)).max(1000).parse(appIds))];
  await db.$transaction(async tx => {
    if (!await tx.company.findUnique({ where: { id: companyId } })) throw new AppError('VALIDATION', 400, 'Company does not exist.');
    if (await tx.app.count({ where: { id: { in: ids } } }) !== ids.length) throw new AppError('VALIDATION', 400, 'One or more apps do not exist.');
    await tx.companyApp.deleteMany({ where: { companyId } });
    if (ids.length) await tx.companyApp.createMany({ data: ids.map(appId => ({ companyId, appId })) });
    await recordAudit({ actorId: actor.id, action: 'ASSIGNMENTS_UPDATED', targetId: companyId, metadata: { count: ids.length } }, tx);
  });
}
export async function listCatalog(actor: Principal, filters: { search?: string; platform?: string }) {
  const current = await loadPrincipal(actor.id);
  return db.app.findMany({
    where: { active: true, ...(current.role === 'CUSTOMER' ? { assignments: { some: { companyId: current.companyId! } } } : {}), ...(filters.search ? { OR: [{ name: { contains: filters.search.slice(0, 100) } }, { description: { contains: filters.search.slice(0, 100) } }] } : {}), ...(filters.platform ? { platform: filters.platform } : {}) },
    orderBy: { name: 'asc' }, include: { releases: { where: { published: true }, orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }], take: 1, select: releaseSelect }, _count: { select: { releases: { where: { published: true } } } } },
  });
}
export async function getAppDetail(actor: Principal, appId: string) {
  await requireAppAccess(actor, appId, 'browse');
  return db.app.findUniqueOrThrow({ where: { id: appId }, include: { releases: { where: { published: true }, orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }], select: releaseSelect } } });
}
export async function listAdminApps(actor: Principal) { requireAdmin(await loadPrincipal(actor.id)); return db.app.findMany({ orderBy: { name: 'asc' }, include: { _count: { select: { releases: true, assignments: true } } } }); }
export async function getAdminApp(actor: Principal, appId: string) { requireAdmin(await loadPrincipal(actor.id)); return db.app.findUniqueOrThrow({ where: { id: appId }, include: { releases: { orderBy: { createdAt: 'desc' }, select: releaseSelect }, assignments: { include: { company: true } } } }); }
