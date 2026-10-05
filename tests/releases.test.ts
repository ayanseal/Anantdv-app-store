import { beforeEach, it, expect } from 'vitest';
import { db } from '@/server/db';
import { fixture, resetDb } from './helpers';
import { loadPrincipal } from '@/server/auth/principal';
import { createRelease, openDownload, setReleasePublished, deleteRelease } from '@/server/services/releases';
import { listCatalog, getAppDetail, deleteApp } from '@/server/services/apps';
import { promises as fs } from 'node:fs';
beforeEach(resetDb);
it('enforces publication and company permissions for downloads', async () => {
  const f = await fixture();
  const admin = await loadPrincipal(f.admin.id);
  const customer = await loadPrincipal(f.customer.id);
  const viewer = await loadPrincipal(f.viewer.id);
  const release = await createRelease(admin, f.app.id, { version: '1.0', notes: 'New features', published: false }, new File(['binary'], 'app.apk'));
  await expect(openDownload(customer, release.id)).rejects.toThrow();
  await setReleasePublished(admin, release.id, true);
  const download = await openDownload(customer, release.id);
  expect(await new Response(download.stream).text()).toBe('binary');
  await expect(openDownload(viewer, release.id)).rejects.toThrow();
  const foreign = await createRelease(admin, f.foreign.id, { version: '1.0', notes: 'Foreign features', published: true }, new File(['other'], 'other.ipa'));
  await expect(openDownload(customer, foreign.id)).rejects.toThrow();
  await expect(createRelease(viewer, f.app.id, { version: '2.0', notes: '', published: true }, new File(['evil'], 'app.apk'))).rejects.toThrow();
});
it('cleans up duplicate releases and reports missing files', async () => {
  const f = await fixture();
  const admin = await loadPrincipal(f.admin.id);
  const input = { version: '1.0', notes: '', published: true };
  const first = await createRelease(admin, f.app.id, input, new File(['one'], 'app.apk'));
  const before = await fs.readdir('data/test-uploads');
  await expect(createRelease(admin, f.app.id, input, new File(['two'], 'app.apk'))).rejects.toThrow();
  expect(await fs.readdir('data/test-uploads')).toEqual(before);
  await fs.unlink(`data/test-uploads/${first.storageKey}`);
  await expect(openDownload(admin, first.id)).rejects.toThrow();
});
it('shows assigned published releases with latest determined by publication', async () => {
  const f = await fixture();
  const admin = await loadPrincipal(f.admin.id);
  const older = await createRelease(admin, f.app.id, { version: '9.0', notes: 'Old', published: true }, new File(['old'], 'app.apk'));
  await db.release.update({ where: { id: older.id }, data: { publishedAt: new Date('2025-01-01') } });
  await createRelease(admin, f.app.id, { version: '1.0', notes: 'Newest published', published: true }, new File(['new'], 'app.apk'));
  await createRelease(admin, f.app.id, { version: 'draft', notes: 'Hidden', published: false }, new File(['draft'], 'app.apk'));
  const customer = await loadPrincipal(f.customer.id);
  const detail = await getAppDetail(customer, f.app.id);
  expect(detail.releases.map(r => r.version)).toEqual(['1.0', '9.0']);
  expect((await listCatalog(customer, {})).map(a => a.id)).toEqual([f.app.id]);
  await expect(getAppDetail(customer, f.foreign.id)).rejects.toThrow();
  expect(await listCatalog(customer, { search: 'no-match' })).toEqual([]);
});
it('supports normal delete (preserving files on disk) and root purge for releases and apps', async () => {
  const f = await fixture();
  const admin = await loadPrincipal(f.admin.id);

  // 1. Release normal delete preserves file on disk
  const rel1 = await createRelease(admin, f.app.id, { version: '3.0', notes: 'Test normal', published: true }, new File(['content-v3'], 'app.apk'));
  await deleteRelease(admin, rel1.id, false);
  expect(await db.release.findUnique({ where: { id: rel1.id } })).toBeNull();
  expect((await fs.stat(`data/test-uploads/${rel1.storageKey}`)).isFile()).toBe(true);

  // 2. Release root purge removes file and folder from disk
  const rel2 = await createRelease(admin, f.app.id, { version: '4.0', notes: 'Test purge', published: true }, new File(['content-v4'], 'app.apk'));
  await deleteRelease(admin, rel2.id, true);
  expect(await db.release.findUnique({ where: { id: rel2.id } })).toBeNull();
  await expect(fs.stat(`data/test-uploads/${rel2.storageKey}`)).rejects.toThrow();

  // 3. App normal delete keeps app folder on disk
  await deleteApp(admin, f.app.id, false);
  expect(await db.app.findUnique({ where: { id: f.app.id } })).toBeNull();
  expect((await fs.stat(`data/test-uploads/apps/${f.app.slug}`)).isDirectory()).toBe(true);

  // 4. App root purge removes entire app directory from disk
  await createRelease(admin, f.foreign.id, { version: '1.0', notes: '', published: true }, new File(['other-bin'], 'other.apk'));
  await deleteApp(admin, f.foreign.id, true);
  expect(await db.app.findUnique({ where: { id: f.foreign.id } })).toBeNull();
  await expect(fs.stat(`data/test-uploads/apps/${f.foreign.slug}`)).rejects.toThrow();
});

