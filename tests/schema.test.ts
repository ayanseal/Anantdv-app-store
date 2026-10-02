import { beforeEach, it, expect } from 'vitest';
import { db } from '@/server/db';
beforeEach(async () => {
  await db.companyApp.deleteMany();
  await db.release.deleteMany();
  await db.refreshSession.deleteMany();
  await db.authChallenge.deleteMany();
  await db.recoveryCode.deleteMany();
  await db.user.deleteMany();
  await db.app.deleteMany();
  await db.company.deleteMany();
});
it('rejects duplicate emails and assignments', async () => {
  const company = await db.company.create({ data: { name: 'Test', slug: 'test' } });
  const app = await db.app.create({ data: { name: 'Test app', slug: 'test-app', description: 'Test', platform: 'Android' } });
  const user = { email: 'a@test.example', name: 'A', passwordHash: 'hash', role: 'CUSTOMER' as const, companyId: company.id };
  await db.user.create({ data: user });
  await expect(db.user.create({ data: user })).rejects.toThrow();
  await db.companyApp.create({ data: { companyId: company.id, appId: app.id } });
  await expect(db.companyApp.create({ data: { companyId: company.id, appId: app.id } })).rejects.toThrow();
});
it('rejects duplicate versions within an app', async () => {
  const uploader = await db.user.create({ data: { email: 'admin@test.example', name: 'Admin', passwordHash: 'hash', role: 'ADMIN' } });
  const app = await db.app.create({ data: { name: 'Test app', slug: 'test', description: 'Test', platform: 'Android' } });
  const release = { appId: app.id, version: '1.0', notes: 'Features', storageKey: 'one', filename: 'app.apk', contentType: 'application/octet-stream', size: 4, checksum: 'abcd', uploaderId: uploader.id };
  await db.release.create({ data: release });
  await expect(db.release.create({ data: { ...release, storageKey: 'two' } })).rejects.toThrow();
});
