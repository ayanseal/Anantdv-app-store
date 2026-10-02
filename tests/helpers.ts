import { db } from '@/server/db';
import { hashPassword } from '@/server/auth/password';
export async function resetDb() {
  await db.auditEvent.deleteMany();
  await db.recoveryCode.deleteMany();
  await db.authChallenge.deleteMany();
  await db.refreshSession.deleteMany();
  await db.release.deleteMany();
  await db.companyApp.deleteMany();
  await db.app.deleteMany();
  await db.user.deleteMany();
  await db.company.deleteMany();
  await db.loginThrottle.deleteMany();
}
export async function fixture() {
  const company = await db.company.create({ data: { name: 'Acme', slug: 'acme' } });
  const other = await db.company.create({ data: { name: 'Other', slug: 'other' } });
  const passwordHash = await hashPassword('Long-test-password-123!');
  const admin = await db.user.create({ data: { email: 'admin@test.example', name: 'Administrator', role: 'ADMIN', passwordHash, mustChangePassword: false, mfaEnabled: true } });
  const customer = await db.user.create({ data: { email: 'customer@test.example', name: 'Customer', role: 'CUSTOMER', companyId: company.id, passwordHash, mustChangePassword: false } });
  const viewer = await db.user.create({ data: { email: 'viewer@test.example', name: 'Viewer', role: 'VIEWER', passwordHash, mustChangePassword: false } });
  const app = await db.app.create({ data: { name: 'Acme Mobile', slug: 'acme-mobile', description: 'Operations', platform: 'Android', assignments: { create: { companyId: company.id } } } });
  const foreign = await db.app.create({ data: { name: 'Other Mobile', slug: 'other-mobile', description: 'Other operations', platform: 'iOS', assignments: { create: { companyId: other.id } } } });
  return { company, other, admin, customer, viewer, app, foreign };
}
