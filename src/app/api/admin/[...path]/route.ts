import { z } from 'zod';
import { db } from '@/server/db';
import { route, json, jsonBody, assertMutationOrigin, getRequestPrincipal } from '@/server/http';
import { requireAdmin, requireAdminOrViewer } from '@/server/auth/principal';
import { listCompanies, saveCompany } from '@/server/services/companies';
import { listUsers, saveUser, resetUserPassword, resetUserMfa } from '@/server/services/users';
import { listAdminApps, saveApp, setCompanyApps, setAppCompanies, saveAppIcon, saveCompanyLogo, deleteApp } from '@/server/services/apps';
import { createReleaseFromStored, setReleasePublished, deleteRelease } from '@/server/services/releases';
import { readMultipart, readMultipartImage } from '@/server/storage';
import { AppError } from '@/server/errors';
import { getConfig } from '@/config/env';
import { promises as fs } from 'node:fs';
import nodePath from 'node:path';
type Context = { params: Promise<{ path: string[] }> };
export async function GET(_request: Request, context: Context) {
  return route(async () => {
    const actor = await getRequestPrincipal(); requireAdminOrViewer(actor);
    const { path } = await context.params;
    if (path.length !== 1 && !(path.length === 3 && path[0] === 'apps' && path[2] === 'icon')) throw new AppError('NOT_FOUND', 404, 'Not found.');
    if (path.length === 3 && path[0] === 'apps' && path[2] === 'icon') {
      const app = await db.app.findUnique({ where: { id: path[1] } });
      if (!app?.iconUrl) throw new AppError('NOT_FOUND', 404, 'No icon.');
      const config = getConfig();
      const iconsDir = nodePath.join(config.uploadDir, 'icons');
      const files = await fs.readdir(iconsDir).catch(() => [] as string[]);
      const iconFile = files.find(f => f.startsWith(`${path[1]}.`));
      if (!iconFile) throw new AppError('NOT_FOUND', 404, 'Icon file missing.');
      const buf = await fs.readFile(nodePath.join(iconsDir, iconFile));
      const ext = iconFile.split('.').pop()?.toLowerCase();
      const mime = ext === 'png' ? 'image/png' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'gif' ? 'image/gif' : ext === 'webp' ? 'image/webp' : 'image/png';
      return new Response(buf, { headers: { 'Content-Type': mime, 'Cache-Control': 'no-cache, must-revalidate' } });
    }
    switch (path[0]) {
      case 'companies': return json(await listCompanies(actor));
      case 'users': return json(await listUsers(actor));
      case 'apps': return json(await listAdminApps(actor));
      case 'audit': return json(await db.auditEvent.findMany({ orderBy: { createdAt: 'desc' }, take: 200 }));
      default: throw new AppError('NOT_FOUND', 404, 'Not found.');
    }
  });
}
export async function POST(request: Request, context: Context) {
  return route(async () => {
    assertMutationOrigin(request);
    const actor = await getRequestPrincipal(); requireAdmin(actor);
    const { path } = await context.params;
    if (path.length === 3 && path[0] === 'apps' && path[2] === 'releases') {
      const upload = await readMultipart(request);
      const release = await createReleaseFromStored(actor, path[1], { version: upload.fields.version, notes: upload.fields.notes || '', published: upload.fields.published === 'true' }, upload.file);
      return json({ id: release.id, version: release.version }, 201);
    }
    if (path.length === 3 && path[0] === 'apps' && path[2] === 'icon') {
      const upload = await readMultipartImage(request);
      const result = await saveAppIcon(actor, path[1], upload);
      return json(result);
    }
    if (path.length === 3 && path[0] === 'companies' && path[2] === 'logo') {
      const upload = await readMultipartImage(request);
      const result = await saveCompanyLogo(actor, path[1], upload);
      return json(result);
    }
    const input = await jsonBody(request);
    if (path.length === 1) {
      switch (path[0]) {
        case 'companies': return json(await saveCompany(actor, input));
        case 'users': return json(await saveUser(actor, input));
        case 'apps': return json(await saveApp(actor, input));
      }
    }
    if (path.length === 3 && path[0] === 'users') {
      if (path[2] === 'password') return json(await resetUserPassword(actor, path[1]));
      if (path[2] === 'mfa') { await resetUserMfa(actor, path[1]); return json({ ok: true }); }
    }
    if (path.length === 3 && path[0] === 'companies' && path[2] === 'apps') {
      const { appIds } = z.object({ appIds: z.array(z.string()) }).parse(input);
      await setCompanyApps(actor, path[1], appIds); return json({ ok: true });
    }
    if (path.length === 3 && path[0] === 'apps' && path[2] === 'companies') {
      const { companyIds } = z.object({ companyIds: z.array(z.string()) }).parse(input);
      await setAppCompanies(actor, path[1], companyIds); return json({ ok: true });
    }
    if (path.length === 3 && path[0] === 'apps' && path[2] === 'delete') {
      const { purge } = z.object({ purge: z.boolean().optional() }).parse(input || {});
      return json(await deleteApp(actor, path[1], Boolean(purge)));
    }
    if (path.length === 3 && path[0] === 'releases' && path[2] === 'delete') {
      const { purge } = z.object({ purge: z.boolean().optional() }).parse(input || {});
      return json(await deleteRelease(actor, path[1], Boolean(purge)));
    }
    if (path.length === 2 && path[0] === 'releases') {
      const { published } = z.object({ published: z.boolean() }).parse(input);
      return json(await setReleasePublished(actor, path[1], published));
    }
    throw new AppError('NOT_FOUND', 404, 'Not found.');
  });
}

export async function DELETE(request: Request, context: Context) {
  return route(async () => {
    assertMutationOrigin(request);
    const actor = await getRequestPrincipal(); requireAdmin(actor);
    const { path } = await context.params;
    const url = new URL(request.url);
    const purge = url.searchParams.get('purge') === 'true';

    if (path.length === 2 && path[0] === 'apps') {
      return json(await deleteApp(actor, path[1], purge));
    }
    if (path.length === 2 && path[0] === 'releases') {
      return json(await deleteRelease(actor, path[1], purge));
    }
    throw new AppError('NOT_FOUND', 404, 'Not found.');
  });
}
