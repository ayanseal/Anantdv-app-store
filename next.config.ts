import type { NextConfig } from 'next';
const config: NextConfig = {
  poweredByHeader: false,
  devIndicators: false,
  allowedDevOrigins: [
    '*',
    '**',
    '*.local',
    '192.168.*',
    '10.*',
    '172.*',
    '192.168.5.145',
    'localhost',
    '127.0.0.1',
  ],
  distDir: process.env.PAYANA_E2E === 'true' ? '.next-e2e' : '.next',
  serverExternalPackages: ['@prisma/client', '@prisma/adapter-better-sqlite3', 'better-sqlite3', 'busboy'],
  async headers() {
    return [{ source: '/:path*', headers: [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Referrer-Policy', value: 'same-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      { key: 'Content-Security-Policy', value: `default-src 'self'; script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''}; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'${process.env.NODE_ENV === 'development' ? " ws: wss:" : ''}; frame-ancestors 'none'; base-uri 'self'; form-action 'self'` },
      ...(process.env.NODE_ENV === 'production' ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' }] : []),
    ] }];
  },
};
export default config;
