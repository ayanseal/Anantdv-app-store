import { z } from 'zod';
import { db } from '@/server/db';
import { loadPrincipal, requireAdmin, requireAppAccess, type Principal } from '@/server/auth/principal';
import { storeUpload, removeStoredFile, openStoredFile, type StoredFile } from '@/server/storage';
import { recordAudit } from '@/server/audit';
import { AppError, forbidden } from '@/server/errors';
export const releaseInput = z.object({ version: z.string().trim().min(1).max(60), notes: z.string().max(15000), published: z.boolean() });
export type ReleaseInput = z.infer<typeof releaseInput>;
export async function createRelease(actor: Principal, appId: string, raw: ReleaseInput, file: File) {
  requireAdmin(await loadPrincipal(actor.id));
  const input = releaseInput.parse(raw);
  const stored = await storeUpload(file);
  return createReleaseFromStored(actor, appId, input, stored);
}
export async function createReleaseFromStored(actor: Principal, appId: string, raw: ReleaseInput, file: StoredFile) {
  try {
    requireAdmin(await loadPrincipal(actor.id));
    const input = releaseInput.parse(raw);
    return await db.$transaction(async tx => {
      const release = await tx.release.create({ data: { appId, ...input, storageKey: file.key, filename: file.filename, contentType: file.contentType, size: file.size, checksum: file.checksum, uploaderId: actor.id, publishedAt: input.published ? new Date() : null } });
      await recordAudit({ actorId: actor.id, action: 'RELEASE_CREATED', targetId: release.id, metadata: { appId, version: release.version, published: release.published } }, tx);
      return release;
    });
  } catch (error) { await removeStoredFile(file.key); throw error; }
}
export async function setReleasePublished(actor: Principal, releaseId: string, published: boolean) {
  requireAdmin(await loadPrincipal(actor.id));
  return db.$transaction(async tx => {
    const previous = await tx.release.findUniqueOrThrow({ where: { id: releaseId } });
    // Republishing preserves original publication time; publishing a draft establishes it.
    const release = await tx.release.update({ where: { id: releaseId }, data: { published, publishedAt: published ? previous.publishedAt ?? new Date() : previous.publishedAt } });
    await recordAudit({ actorId: actor.id, action: published ? 'RELEASE_PUBLISHED' : 'RELEASE_UNPUBLISHED', targetId: releaseId, metadata: { version: release.version, published } }, tx);
    return { id: release.id, published: release.published };
  });
}
export async function openDownload(actor: Principal, releaseId: string) {
  const principal = await loadPrincipal(actor.id);
  const release = await db.release.findUnique({ where: { id: releaseId } });
  if (!release) throw forbidden();
  await requireAppAccess(principal, release.appId, 'download');
  if (!release.published && principal.role !== 'ADMIN') throw forbidden();
  const stream = await openStoredFile(release.storageKey);
  if (release.size <= 0) throw new AppError('FILE_MISSING', 404, 'This binary is unavailable.');
  await recordAudit({ actorId: principal.id, action: 'DOWNLOAD', targetId: release.id, metadata: { appId: release.appId, version: release.version } });
  return { stream, filename: release.filename, size: release.size, contentType: release.contentType };
}
