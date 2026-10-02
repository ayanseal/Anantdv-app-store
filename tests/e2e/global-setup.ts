import { migrateTestDatabase } from '../migrate-test-db';
import { db } from '@/server/db';
import { fixture, resetDb } from '../helpers';
import { encryptSecret } from '@/server/auth/mfa';
import { createRelease } from '@/server/services/releases';
import { loadPrincipal } from '@/server/auth/principal';
export default async function setup() {
  migrateTestDatabase('data/e2e.db');
  await resetDb();
  const f = await fixture();
  await db.user.create({ data: { email: 'newadmin@test.example', name: 'New Administrator', role: 'ADMIN', passwordHash: f.admin.passwordHash, mustChangePassword: false } });
  await db.user.update({ where: { id: f.admin.id }, data: { mfaSecret: encryptSecret('JBSWY3DPEHPK3PXP'), lastTotpStep: 0n } });
  const admin = await loadPrincipal(f.admin.id);
  await createRelease(admin, f.app.id, { version: '1.0', notes: 'Offline access and improved sync.', published: true }, new File(['previous binary'], 'acme-1.apk'));
  const latest = await createRelease(admin, f.app.id, { version: '2.0', notes: 'A faster dashboard and better reporting.', published: true }, new File(['latest binary'], 'acme-2.apk'));
  const foreign = await createRelease(admin, f.foreign.id, { version: '1.0', notes: 'Other company release.', published: true }, new File(['other binary'], 'other.ipa'));
  process.env.E2E_RELEASE_ID = latest.id;
  process.env.E2E_FOREIGN_RELEASE_ID = foreign.id;
  process.env.E2E_APP_ID = f.app.id;
  await db.$disconnect();
}
