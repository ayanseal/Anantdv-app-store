import { z } from 'zod';
import { db } from '@/server/db';
import { loadPrincipal, requireAdmin, requireAppAccess, type Principal } from '@/server/auth/principal';
import { recordAudit } from '@/server/audit';
import { AppError } from '@/server/errors';
export const appInput = z.object({ id: z.string().optional(), name: z.string().trim().min(1).max(100), slug: z.string().trim().min(1).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), description: z.string().trim().max(3000), platform: z.enum(['Android', 'iOS', 'Windows', 'macOS', 'Linux', 'Other']), active: z.boolean(), isPublic: z.boolean().optional().default(false) });
export type AppInput = z.input<typeof appInput>;
export const releaseSelect = { id: true, version: true, notes: true, filename: true, size: true, checksum: true, published: true, publishedAt: true, createdAt: true } as const;
export async function saveApp(actor: Principal, raw: AppInput) {
  requireAdmin(await loadPrincipal(actor.id));
  const { id, ...input } = appInput.parse(raw);
  return db.$transaction(async tx => {
    const app = id ? await tx.app.update({ where: { id }, data: input }) : await tx.app.create({ data: input });
    await recordAudit({ actorId: actor.id, action: id ? 'APP_UPDATED' : 'APP_CREATED', targetId: app.id, metadata: { active: app.active, isPublic: app.isPublic } }, tx);
    return app;
  });
}
export async function setCompanyApps(actor: Principal, companyId: string, appIds: string[]) {
  requireAdmin(await loadPrincipal(actor.id));
  const ids = [...new Set(z.array(z.string().min(1)).max(1000).parse(appIds))];
  await db.$transaction(async tx => {
    if (!await tx.company.findUnique({ where: { id: companyId } })) throw new AppError('VALIDATION', 400, 'Company does not exist.');
    if (ids.length && await tx.app.count({ where: { id: { in: ids } } }) !== ids.length) throw new AppError('VALIDATION', 400, 'One or more apps do not exist.');
    await tx.companyApp.deleteMany({ where: { companyId } });
    if (ids.length) await tx.companyApp.createMany({ data: ids.map(appId => ({ companyId, appId })) });
    await recordAudit({ actorId: actor.id, action: 'ASSIGNMENTS_UPDATED', targetId: companyId, metadata: { count: ids.length } }, tx);
  });
}
export async function setAppCompanies(actor: Principal, appId: string, companyIds: string[]) {
  requireAdmin(await loadPrincipal(actor.id));
  const ids = [...new Set(z.array(z.string().min(1)).max(1000).parse(companyIds))];
  await db.$transaction(async tx => {
    if (!await tx.app.findUnique({ where: { id: appId } })) throw new AppError('VALIDATION', 400, 'App does not exist.');
    if (ids.length && await tx.company.count({ where: { id: { in: ids } } }) !== ids.length) throw new AppError('VALIDATION', 400, 'One or more companies do not exist.');
    await tx.companyApp.deleteMany({ where: { appId } });
    if (ids.length) await tx.companyApp.createMany({ data: ids.map(companyId => ({ companyId, appId })) });
    await recordAudit({ actorId: actor.id, action: 'ASSIGNMENTS_UPDATED', targetId: appId, metadata: { count: ids.length } }, tx);
  });
}

export async function listCatalog(actor: Principal | null, filters: { search?: string; platform?: string }) {
  const searchWhere = {
    ...(filters.search ? { OR: [{ name: { contains: filters.search.slice(0, 100) } }, { description: { contains: filters.search.slice(0, 100) } }] } : {}),
    ...(filters.platform ? { platform: filters.platform } : {}),
  };
  if (!actor) {
    // Unauthenticated: public apps only
    return db.app.findMany({
      where: { active: true, isPublic: true, ...searchWhere },
      orderBy: { name: 'asc' },
      include: { releases: { where: { published: true }, orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }], take: 1, select: releaseSelect }, _count: { select: { releases: { where: { published: true } } } } },
    });
  }
  const current = await loadPrincipal(actor.id);
  const roleWhere = current.role === 'CUSTOMER'
    ? { assignments: { some: { companyId: current.companyId! } } }
    : {}; // ADMIN and VIEWER see all active apps
  return db.app.findMany({
    where: { active: true, ...roleWhere, ...searchWhere },
    orderBy: { name: 'asc' },
    include: { releases: { where: { published: true }, orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }], take: 1, select: releaseSelect }, _count: { select: { releases: { where: { published: true } } } } },
  });
}
export async function getAppDetail(actor: Principal | null, appId: string) {
  if (!actor) {
    // Unauthenticated: only public apps
    const app = await db.app.findUnique({ where: { id: appId, active: true, isPublic: true }, include: { releases: { where: { published: true }, orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }], select: releaseSelect } } });
    if (!app) throw new AppError('FORBIDDEN', 403, 'Not found.');
    return app;
  }
  await requireAppAccess(actor, appId, 'browse');
  return db.app.findUniqueOrThrow({ where: { id: appId }, include: { releases: { where: { published: true }, orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }], select: releaseSelect } } });
}
async function saveImageFile(entityId: string, subdir: string, file: { path: string; filename: string; contentType: string; size: number }) {
  if (!file.contentType.startsWith('image/')) throw new AppError('VALIDATION', 400, 'File must be an image.');
  if (file.size > 2 * 1024 * 1024) throw new AppError('VALIDATION', 400, 'Image must be under 2 MB.');
  const { getConfig } = await import('@/config/env');
  const { promises: fs } = await import('node:fs');
  const path = await import('node:path');
  const config = getConfig();
  const dir = path.join(config.uploadDir, subdir);
  await fs.mkdir(dir, { recursive: true });
  // Remove old file for this entity
  const existing = await fs.readdir(dir).catch(() => [] as string[]);
  for (const f of existing.filter(f => f.startsWith(`${entityId}.`))) await fs.rm(path.join(dir, f), { force: true });
  const ext = file.filename.split('.').pop()?.toLowerCase() || 'png';
  const dest = path.join(dir, `${entityId}.${ext}`);
  await fs.copyFile(file.path, dest);
  await fs.unlink(file.path).catch(() => {});
}
export async function saveAppIcon(actor: Principal, appId: string, file: { path: string; filename: string; contentType: string; size: number }) {
  requireAdmin(await loadPrincipal(actor.id));
  const app = await db.app.findUnique({ where: { id: appId }, select: { slug: true } });
  if (app?.slug) {
    const { getConfig } = await import('@/config/env');
    const { promises: fs } = await import('node:fs');
    const path = await import('node:path');
    const config = getConfig();
    const appDir = path.join(config.uploadDir, 'apps', app.slug);
    await fs.mkdir(appDir, { recursive: true });
    // Remove previous icon files in apps/<slug>/
    const existing = await fs.readdir(appDir).catch(() => [] as string[]);
    for (const f of existing.filter(f => f.startsWith('icon.'))) {
      await fs.rm(path.join(appDir, f), { force: true }).catch(() => {});
    }
    const ext = file.filename.split('.').pop()?.toLowerCase() || 'png';
    await fs.copyFile(file.path, path.join(appDir, `icon.${ext}`)).catch(() => {});
  }
  await saveImageFile(appId, 'icons', file);
  const iconUrl = `/api/images/apps/${appId}?t=${Date.now()}`;
  await db.app.update({ where: { id: appId }, data: { iconUrl } });
  await recordAudit({ actorId: actor.id, action: 'APP_UPDATED', targetId: appId, metadata: { icon: true } });
  return { iconUrl };
}
export async function saveCompanyLogo(actor: Principal, companyId: string, file: { path: string; filename: string; contentType: string; size: number }) {
  requireAdmin(await loadPrincipal(actor.id));
  await saveImageFile(companyId, 'logos', file);
  const logoUrl = `/api/images/companies/${companyId}?t=${Date.now()}`;
  await db.company.update({ where: { id: companyId }, data: { logoUrl } });
  await recordAudit({ actorId: actor.id, action: 'COMPANY_UPDATED', targetId: companyId, metadata: { logo: true } });
  return { logoUrl };
}
export async function listAdminApps(actor: Principal) { requireAdmin(await loadPrincipal(actor.id)); return db.app.findMany({ orderBy: { name: 'asc' }, include: { _count: { select: { releases: true, assignments: true } } } }); }
export async function getAdminApp(actor: Principal, appId: string) { requireAdmin(await loadPrincipal(actor.id)); return db.app.findUniqueOrThrow({ where: { id: appId }, include: { releases: { orderBy: { createdAt: 'desc' }, select: releaseSelect }, assignments: { include: { company: true } } } }); }

export async function deleteApp(actor: Principal, appId: string, purgeFiles: boolean = false) {
  requireAdmin(await loadPrincipal(actor.id));
  const app = await db.app.findUniqueOrThrow({
    where: { id: appId },
    include: { releases: true },
  });

  await db.$transaction(async tx => {
    await tx.companyApp.deleteMany({ where: { appId } });
    await tx.release.deleteMany({ where: { appId } });
    await tx.app.delete({ where: { id: appId } });
    await recordAudit({
      actorId: actor.id,
      action: purgeFiles ? 'APP_PURGED' : 'APP_DELETED',
      targetId: appId,
      metadata: {
        appName: app.name,
        appSlug: app.slug,
        purgeFiles,
        releaseCount: app.releases.length,
      },
    }, tx);
  });

  if (purgeFiles) {
    const { getConfig } = await import('@/config/env');
    const { promises: fs } = await import('node:fs');
    const path = await import('node:path');
    const config = getConfig();

    // 1. Delete app folder on disk: data/uploads/apps/<app.slug>
    const safeSlug = app.slug.replace(/[^a-zA-Z0-9_-]/g, '_');
    const appDir = path.join(config.uploadDir, 'apps', safeSlug);
    await fs.rm(appDir, { recursive: true, force: true }).catch(() => {});

    // 2. Delete icon in data/uploads/icons/<appId>.*
    const iconsDir = path.join(config.uploadDir, 'icons');
    const iconFiles = await fs.readdir(iconsDir).catch(() => [] as string[]);
    for (const f of iconFiles.filter(f => f.startsWith(`${appId}.`))) {
      await fs.rm(path.join(iconsDir, f), { force: true }).catch(() => {});
    }

    // 3. Delete any legacy staging UUID files if present
    for (const rel of app.releases) {
      if (/^[a-f0-9-]{36}$/.test(rel.storageKey)) {
        await fs.rm(path.join(config.uploadDir, rel.storageKey), { force: true }).catch(() => {});
      }
    }
  }

  return { id: appId, name: app.name, purged: purgeFiles };
}
