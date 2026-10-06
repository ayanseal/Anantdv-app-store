import { z } from 'zod';
import { db } from '@/server/db';
import { loadPrincipal, requireAdmin, requireAppAccess, type Principal } from '@/server/auth/principal';
import { storeUpload, removeStoredFile, openStoredFile, relocateToAppFolder, type StoredFile } from '@/server/storage';
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
  let finalKey = file.key;
  try {
    requireAdmin(await loadPrincipal(actor.id));
    const input = releaseInput.parse(raw);
    const existing = await db.release.findUnique({
      where: { appId_version: { appId, version: input.version } },
      select: { id: true },
    });
    if (existing) {
      throw new AppError('VALIDATION', 400, 'A release with this version already exists.');
    }
    const app = await db.app.findUniqueOrThrow({ where: { id: appId }, select: { id: true, name: true, slug: true } });

    finalKey = await relocateToAppFolder(file.key, app.slug, input.version, file.filename, {
      appId: app.id,
      appName: app.name,
      appSlug: app.slug,
      version: input.version,
      filename: file.filename,
      size: file.size,
      checksum: file.checksum,
      contentType: file.contentType,
      notes: input.notes,
      published: input.published,
      createdAt: new Date().toISOString(),
    });

    try {
      return await db.$transaction(async tx => {
        const release = await tx.release.create({
          data: {
            appId,
            ...input,
            storageKey: finalKey,
            filename: file.filename,
            contentType: file.contentType,
            size: file.size,
            checksum: file.checksum,
            uploaderId: actor.id,
            publishedAt: input.published ? new Date() : null,
          },
        });
        await recordAudit({
          actorId: actor.id,
          action: 'RELEASE_CREATED',
          targetId: release.id,
          metadata: { appId, version: release.version, published: release.published, folder: finalKey },
        }, tx);
        return release;
      });
    } catch (dbError) {
      await removeStoredFile(finalKey);
      throw dbError;
    }
  } catch (error) {
    if (finalKey === file.key) {
      await removeStoredFile(file.key).catch(() => {});
    }
    throw error;
  }
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
export async function openDownload(actor: Principal | null, releaseId: string) {
  const release = await db.release.findUnique({ where: { id: releaseId }, include: { app: { select: { isPublic: true, active: true } } } });
  if (!release) throw forbidden();

  let principal: Principal | null = null;
  if (actor) {
    principal = await loadPrincipal(actor.id);
  }

  const isStaff = principal && (principal.role === 'ADMIN' || principal.role === 'VIEWER');
  if (!release.published && !isStaff) throw forbidden();

  // Public app: anyone can download published releases without an account
  if (release.app.isPublic && release.app.active && release.published) {
    const stream = await openStoredFile(release.storageKey);
    if (release.size <= 0) throw new AppError('FILE_MISSING', 404, 'This binary is unavailable.');
    return { stream, filename: release.filename, size: release.size, contentType: release.contentType };
  }

  // Private app or unreleased draft: must be authenticated with access
  if (!principal) throw forbidden();
  await requireAppAccess(principal, release.appId, 'download');
  const stream = await openStoredFile(release.storageKey);
  if (release.size <= 0) throw new AppError('FILE_MISSING', 404, 'This binary is unavailable.');
  await recordAudit({ actorId: principal.id, action: 'DOWNLOAD', targetId: release.id, metadata: { appId: release.appId, version: release.version } });
  return { stream, filename: release.filename, size: release.size, contentType: release.contentType };
}

export async function deleteRelease(actor: Principal, releaseId: string, purgeFiles: boolean = false) {
  requireAdmin(await loadPrincipal(actor.id));
  const release = await db.release.findUniqueOrThrow({
    where: { id: releaseId },
    include: { app: { select: { id: true, name: true, slug: true } } },
  });

  await db.$transaction(async tx => {
    await tx.release.delete({ where: { id: releaseId } });
    await recordAudit({
      actorId: actor.id,
      action: purgeFiles ? 'RELEASE_PURGED' : 'RELEASE_DELETED',
      targetId: releaseId,
      metadata: {
        appId: release.appId,
        appName: release.app.name,
        version: release.version,
        storageKey: release.storageKey,
        purgeFiles,
      },
    }, tx);
  });

  if (purgeFiles) {
    const { getConfig } = await import('@/config/env');
    const { promises: fs } = await import('node:fs');
    const path = await import('node:path');
    const config = getConfig();

    await removeStoredFile(release.storageKey).catch(() => {});

    if (release.storageKey.startsWith('apps/')) {
      const fullFilePath = path.resolve(config.uploadDir, release.storageKey);
      const versionDir = path.dirname(fullFilePath);
      const appReleasesDir = path.resolve(config.uploadDir, 'apps', release.app.slug, 'releases');
      if (versionDir.startsWith(appReleasesDir) && versionDir !== appReleasesDir) {
        await fs.rm(versionDir, { recursive: true, force: true }).catch(() => {});
      }
    }
  }

  return { id: releaseId, version: release.version, purged: purgeFiles };
}
