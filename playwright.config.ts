import { defineConfig } from '@playwright/test';
process.env.DATABASE_URL = 'file:./data/e2e.db';
process.env.UPLOAD_DIR = './data/e2e-uploads';
process.env.TOKEN_SECRET = 'e2e-only-not-production-token-secret-123456789';
process.env.MFA_ENCRYPTION_KEY = 'cd'.repeat(32);
process.env.PAYANA_E2E = 'true';
export default defineConfig({
  testDir: './tests/e2e', fullyParallel: false, workers: 1, timeout: 60000,
  globalSetup: './tests/e2e/global-setup.ts',
  use: { baseURL: 'http://localhost:3001', headless: true, trace: 'retain-on-failure', screenshot: 'only-on-failure', channel: 'msedge' },
  webServer: process.env.PAYANA_E2E_EXTERNAL === 'true' ? undefined : { command: 'node node_modules/next/dist/bin/next dev --port 3001 --hostname 127.0.0.1', url: 'http://localhost:3001/login', reuseExistingServer: false, timeout: 180000, stdout: 'ignore', stderr: 'pipe', gracefulShutdown: { signal: 'SIGTERM', timeout: 5000 } },
});
