import { randomBytes } from 'node:crypto';
import { promises as fs } from 'node:fs';
await fs.mkdir('data', { recursive: true });
const example = await fs.readFile('.env.example', 'utf8');
const env = example.replace(/^TOKEN_SECRET=$/m, `TOKEN_SECRET=${randomBytes(48).toString('hex')}`).replace(/^MFA_ENCRYPTION_KEY=$/m, `MFA_ENCRYPTION_KEY=${randomBytes(32).toString('hex')}`);
try { await fs.writeFile('.env', env, { flag: 'wx', mode: 0o600 }); console.log('Created .env with private random keys. Existing files are never overwritten.'); }
catch (error) { if ((error as NodeJS.ErrnoException).code === 'EEXIST') console.log('.env already exists; left unchanged.'); else throw error; }
