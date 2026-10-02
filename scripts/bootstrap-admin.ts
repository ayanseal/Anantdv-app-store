import 'dotenv/config';
import { bootstrapAdmin } from '../src/server/bootstrap';
import { db } from '../src/server/db';
const email = process.env.BOOTSTRAP_ADMIN_EMAIL ?? '';
const name = process.env.BOOTSTRAP_ADMIN_NAME || 'Administrator';
const password = process.env.BOOTSTRAP_ADMIN_PASSWORD ?? '';
try {
  await bootstrapAdmin({ email, name, password });
  console.log('Administrator created. Sign in to enroll your authenticator and save recovery codes. Remove the bootstrap password from .env now.');
} catch (error) { console.error(error instanceof Error ? error.message : 'Administrator setup failed'); process.exitCode = 1; }
finally { await db.$disconnect(); }
