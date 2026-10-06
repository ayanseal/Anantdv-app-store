process.env.DATABASE_URL = 'file:./data/test.db';
process.env.UPLOAD_DIR = './data/test-uploads';
process.env.TOKEN_SECRET = 'test-only-secret-not-for-production-123456789';
process.env.MFA_ENCRYPTION_KEY = 'ab'.repeat(32);
