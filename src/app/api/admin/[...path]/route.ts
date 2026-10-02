import { z } from 'zod';
import { db } from '@/server/db';
import { route, json, jsonBody, assertMutationOrigin, getRequestPrincipal } from '@/server/http';
import { requireAdmin } from '@/server/auth/principal';
import { listCompanies, saveCompany } from '@/server/services/companies';
import { listUsers, saveUser, resetUserPassword, resetUserMfa } from '@/server/services/users';
import { listAdminApps, saveApp, setCompanyApps } from '@/server/services/apps';
import { createReleaseFromStored, setReleasePublished } from '@/server/services/releases';
import { readMultipart } from '@/server/storage';
import { AppError } from '@/server/errors';
type Context = { params: Promise<{ path: string[] }> };
export async function GET(_request: Request, context: Context) {
  return route(async () => {
    const actor = await getRequestPrincipal(); requireAdmin(actor);
    const { path } = await context.params;
    if (path.length !== 1) throw new AppError('NOT_FOUND', 404, 'Not found.');
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
    if (path.length === 2 && path[0] === 'releases') {
      const { published } = z.object({ published: z.boolean() }).parse(input);
      return json(await setReleasePublished(actor, path[1], published));
    }
    throw new AppError('NOT_FOUND', 404, 'Not found.');
  });
}
