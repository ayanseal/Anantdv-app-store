import { beforeEach, it, expect } from 'vitest';
import { db } from '@/server/db';
import { loadPrincipal, requireAppAccess } from '@/server/auth/principal';
import { fixture, resetDb } from './helpers';
beforeEach(resetDb);
it('isolates customer apps and allows staff (admin and viewer) global app access and downloads', async () => {
  const f = await fixture();
  const customer = await loadPrincipal(f.customer.id);
  const viewer = await loadPrincipal(f.viewer.id);
  const admin = await loadPrincipal(f.admin.id);
  await expect(requireAppAccess(customer, f.app.id, 'download')).resolves.toBeUndefined();
  await expect(requireAppAccess(customer, f.foreign.id, 'browse')).rejects.toThrow();
  await expect(requireAppAccess(customer, f.foreign.id, 'download')).rejects.toThrow();
  await expect(requireAppAccess(viewer, f.foreign.id, 'browse')).resolves.toBeUndefined();
  await expect(requireAppAccess(viewer, f.app.id, 'download')).resolves.toBeUndefined();
  await expect(requireAppAccess(viewer, f.foreign.id, 'download')).resolves.toBeUndefined();
  await expect(requireAppAccess(admin, f.foreign.id, 'download')).resolves.toBeUndefined();
});
it('removes access immediately when an assignment is removed', async () => {
  const f = await fixture();
  const principal = await loadPrincipal(f.customer.id);
  await db.companyApp.deleteMany();
  await expect(requireAppAccess(principal, f.app.id, 'download')).rejects.toThrow();
});
it('rejects disabled companies and inactive users', async () => {
  const f = await fixture();
  await db.company.update({ where: { id: f.company.id }, data: { active: false } });
  await expect(loadPrincipal(f.customer.id)).rejects.toThrow();
  await db.user.update({ where: { id: f.viewer.id }, data: { active: false } });
  await expect(loadPrincipal(f.viewer.id)).rejects.toThrow();
});
it('rejects password-change and incomplete MFA principals', async () => {
  const f = await fixture();
  await db.user.update({ where: { id: f.customer.id }, data: { mustChangePassword: true } });
  await expect(loadPrincipal(f.customer.id)).rejects.toThrow();
  await db.user.update({ where: { id: f.admin.id }, data: { mfaEnabled: false } });
  await expect(loadPrincipal(f.admin.id)).rejects.toThrow();
});
