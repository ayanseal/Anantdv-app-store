import { beforeEach, it, expect } from 'vitest';
import { db } from '@/server/db';
import { fixture, resetDb } from './helpers';
import { loadPrincipal } from '@/server/auth/principal';
import { saveCompany } from '@/server/services/companies';
import { saveUser, resetUserPassword } from '@/server/services/users';
import { setCompanyApps, saveApp } from '@/server/services/apps';
import { issueSession, principalFromAccess } from '@/server/auth/sessions';
beforeEach(resetDb);
it('restricts management and requires a company for customers', async () => {
  const f = await fixture();
  const admin = await loadPrincipal(f.admin.id);
  await expect(saveCompany(await loadPrincipal(f.viewer.id), { name: 'Illegal', slug: 'illegal', active: true })).rejects.toThrow();
  await expect(saveUser(admin, { email: 'new@test.example', name: 'New', role: 'CUSTOMER', companyId: null, active: true })).rejects.toThrow();
  const result = await saveUser(admin, { email: 'NEW@TEST.EXAMPLE', name: 'New', role: 'CUSTOMER', companyId: f.company.id, active: true });
  expect(result.user.email).toBe('new@test.example');
  expect(result.temporaryPassword).toBeTruthy();
  expect(result.user.mustChangePassword).toBe(true);
  await expect(saveUser(admin, { email: 'new@test.example', name: 'New', role: 'VIEWER', companyId: null, active: true })).rejects.toThrow();
});
it('protects the last administrator from disable or demotion', async () => {
  const f = await fixture();
  const admin = await loadPrincipal(f.admin.id);
  await expect(saveUser(admin, { id: f.admin.id, email: f.admin.email, name: f.admin.name, role: 'VIEWER', active: true, companyId: null })).rejects.toThrow();
  await expect(saveUser(admin, { id: f.admin.id, email: f.admin.email, name: f.admin.name, role: 'ADMIN', active: false, companyId: null })).rejects.toThrow();
  expect((await db.user.findUniqueOrThrow({ where: { id: f.admin.id } })).active).toBe(true);
});
it('replaces assignments atomically and revokes changed accounts', async () => {
  const f = await fixture();
  const admin = await loadPrincipal(f.admin.id);
  await setCompanyApps(admin, f.company.id, [f.app.id, f.app.id]);
  expect(await db.companyApp.count({ where: { companyId: f.company.id } })).toBe(1);
  await expect(setCompanyApps(admin, f.company.id, ['missing'])).rejects.toThrow();
  expect(await db.companyApp.count({ where: { companyId: f.company.id } })).toBe(1);
  const session = await issueSession(f.customer.id);
  await resetUserPassword(admin, f.customer.id);
  await expect(principalFromAccess(session.accessToken)).rejects.toThrow();
  const app = await saveApp(admin, { name: 'Desktop', slug: 'desktop', platform: 'Windows', description: 'Desktop app', active: true });
  expect(app.platform).toBe('Windows');
});
it('preserves an active admin during concurrent demotions', async () => {
  const f = await fixture();
  const second = await db.user.create({ data: { email: 'second@test.example', name: 'Second', role: 'ADMIN', passwordHash: f.admin.passwordHash, mustChangePassword: false, mfaEnabled: true } });
  const actor = await loadPrincipal(f.admin.id);
  await Promise.allSettled([saveUser(actor, { id: f.admin.id, name: 'First', email: f.admin.email, role: 'VIEWER', active: true, companyId: null }), saveUser(actor, { id: second.id, name: 'Second', email: second.email, role: 'VIEWER', active: true, companyId: null })]);
  expect(await db.user.count({ where: { role: 'ADMIN', active: true } })).toBe(1);
});
