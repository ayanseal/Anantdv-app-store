import { promises as fs } from 'node:fs';
import nodePath from 'node:path';
import { db } from '@/server/db';
import { getConfig } from '@/config/env';
import { AppError } from '@/server/errors';
import { route } from '@/server/http';

type Context = { params: Promise<{ type: string; id: string }> };

export async function GET(_req: Request, context: Context) {
  return route(async () => {
    const { type, id } = await context.params;
    if (!/^[a-z0-9_-]+$/.test(id)) throw new AppError('NOT_FOUND', 404, 'Not found.');

    const config = getConfig();
    let subdir: string;

    if (type === 'apps') {
      const app = await db.app.findUnique({ where: { id } });
      if (!app) throw new AppError('NOT_FOUND', 404, 'App not found.');
      subdir = 'icons';
    } else if (type === 'companies') {
      const company = await db.company.findUnique({ where: { id } });
      if (!company) throw new AppError('NOT_FOUND', 404, 'Company not found.');
      subdir = 'logos';
    } else {
      throw new AppError('NOT_FOUND', 404, 'Not found.');
    }

    const dir = nodePath.join(config.uploadDir, subdir);
    const files = await fs.readdir(dir).catch(() => [] as string[]);
    const file = files.find(f => f.startsWith(`${id}.`));
    if (!file) throw new AppError('NOT_FOUND', 404, 'Image missing.');
    const fullPath = nodePath.join(dir, file);
    const stat = await fs.stat(fullPath);
    const etag = `"${stat.mtimeMs.toString(36)}-${stat.size.toString(36)}"`;
    if (_req.headers.get('if-none-match') === etag) {
      return new Response(null, { status: 304, headers: { ETag: etag, 'Cache-Control': 'no-cache, must-revalidate' } });
    }
    const buf = await fs.readFile(fullPath);
    const ext = file.split('.').pop()?.toLowerCase();
    const mime = ext === 'png' ? 'image/png' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : ext === 'gif' ? 'image/gif' : ext === 'webp' ? 'image/webp' : 'image/png';
    return new Response(buf, { headers: { 'Content-Type': mime, ETag: etag, 'Cache-Control': 'no-cache, must-revalidate' } });
  });
}
