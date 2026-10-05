import 'dotenv/config';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const dataDir = path.join(rootDir, 'data');
const uploadsDir = path.join(dataDir, 'uploads');
const logsDir = path.join(dataDir, 'logs');

async function resetProject() {
  console.log('🔄 Resetting project to a clean initial state...\n');

  // 1. Remove database files
  const dbFiles = ['payana.db', 'payana.db-journal', 'payana.db-wal', 'payana.db-shm'];
  for (const f of dbFiles) {
    const full = path.join(dataDir, f);
    await fs.rm(full, { force: true }).catch(() => {});
  }
  console.log('✅ Removed database file (data/payana.db)');

  // 2. Clear uploads directory
  await fs.rm(uploadsDir, { recursive: true, force: true }).catch(() => {});
  await fs.mkdir(uploadsDir, { recursive: true });
  console.log('✅ Cleared uploads directory (data/uploads/)');

  // 3. Clear logs directory
  await fs.rm(logsDir, { recursive: true, force: true }).catch(() => {});
  await fs.mkdir(logsDir, { recursive: true });
  console.log('✅ Cleared activity logs (data/logs/)');

  // 4. Run Prisma database migrations to create clean tables
  console.log('\n📦 Applying database migrations...');
  execSync('npx prisma migrate deploy', { stdio: 'inherit', cwd: rootDir });
  console.log('✅ Database schema created cleanly.');

  // 5. Bootstrap admin user from .env
  console.log('\n👤 Creating administrator account...');
  try {
    const { bootstrapAdmin } = await import('../src/server/bootstrap.js');
    const email = process.env.BOOTSTRAP_ADMIN_EMAIL || 'admin@example.com';
    const name = process.env.BOOTSTRAP_ADMIN_NAME || 'Administrator';
    const password = process.env.BOOTSTRAP_ADMIN_PASSWORD || 'ChangeMe123!';
    await bootstrapAdmin({ email, name, password });
    console.log(`✅ Administrator account created:\n   Email: ${email}\n`);
  } catch (err: unknown) {
    console.warn('⚠️  Could not auto-create admin:', err instanceof Error ? err.message : String(err));
    console.log('   Run: npm run admin:create to create your admin manually.');
  }

  console.log('✨ Project reset complete! You can now start with a fresh store:');
  console.log('   npm run dev\n');
}

resetProject().catch(err => {
  console.error('❌ Reset failed:', err);
  process.exit(1);
});
