import { createReadStream, createWriteStream, promises as fs } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import Busboy from 'busboy';
import { getConfig } from '@/config/env';
import { AppError } from './errors';
export type StoredFile = { key: string; filename: string; size: number; checksum: string; contentType: string };
export function safeFilename(input: string) { return (input.split(/[/\\]/).pop() || 'download').replace(/[\x00-\x1f\x7f"<>:|?*]/g, '_').slice(0, 180); }
export function attachmentHeader(input: string) {
  const name = safeFilename(input);
  const ascii = name.replace(/[^\x20-\x7e]/g, '_');
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name).replace(/['()*]/g, c => '%' + c.charCodeAt(0).toString(16))}`;
}
export function storagePath(key: string) {
  if (!key || typeof key !== 'string') {
    throw new AppError('FILE', 400, 'Invalid file key.');
  }
  const normalized = key.replace(/\\/g, '/');
  if (normalized.includes('..') || path.isAbsolute(key) || normalized.startsWith('/') || /[\x00-\x1f\x7f<>:"|?*]/.test(normalized)) {
    throw new AppError('FILE', 400, 'Invalid file key.');
  }
  const uploadDirResolved = path.resolve(getConfig().uploadDir);
  const fullPath = path.resolve(uploadDirResolved, normalized);
  if (!fullPath.startsWith(uploadDirResolved)) {
    throw new AppError('FILE', 400, 'Invalid file path traversal.');
  }
  return fullPath;
}

export async function relocateToAppFolder(
  sourceKey: string,
  appSlug: string,
  version: string,
  originalFilename: string,
  metadata?: Record<string, unknown>
): Promise<string> {
  const config = getConfig();
  const safeSlug = appSlug.replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeVer = version.replace(/[^a-zA-Z0-9._-]/g, '_');
  const safeName = safeFilename(originalFilename);
  const relDir = path.join('apps', safeSlug, 'releases', `v${safeVer}`);
  const targetDir = path.join(config.uploadDir, relDir);
  await fs.mkdir(targetDir, { recursive: true });

  const destFile = path.join(targetDir, safeName);
  const srcFile = storagePath(sourceKey);

  try {
    await fs.rename(srcFile, destFile);
  } catch {
    await fs.copyFile(srcFile, destFile);
    await fs.unlink(srcFile).catch(() => {});
  }

  if (metadata) {
    const metaPath = path.join(targetDir, 'release-info.json');
    await fs.writeFile(metaPath, JSON.stringify(metadata, null, 2), 'utf-8');
  }

  return path.join(relDir, safeName).replace(/\\/g, '/');
}
export async function storeReadable(source: Readable, originalName: string): Promise<StoredFile> {
  const config = getConfig();
  const filename = safeFilename(originalName);
  if (!config.extensions.some(extension => filename.toLowerCase().endsWith(`.${extension}`))) { source.resume(); throw new AppError('FILE_TYPE', 400, 'This file extension is not allowed.'); }
  await fs.mkdir(config.uploadDir, { recursive: true, mode: 0o700 });
  const key = randomUUID();
  const target = storagePath(key);
  const staging = `${target}.part`;
  let size = 0;
  const hash = createHash('sha256');
  const limit = new Transform({ transform(chunk: Buffer, _encoding, callback) {
    size += chunk.length;
    if (size > config.uploadMaxBytes) return callback(new AppError('TOO_LARGE', 413, 'The file exceeds the upload limit.'));
    hash.update(chunk); callback(null, chunk);
  } });
  try {
    await pipeline(source, limit, createWriteStream(staging, { flags: 'wx', mode: 0o600 }));
    if (!size) throw new AppError('EMPTY_FILE', 400, 'The uploaded file is empty.');
    await fs.rename(staging, target);
    return { key, filename, size, checksum: hash.digest('hex'), contentType: 'application/octet-stream' };
  } catch (error) { await fs.rm(staging, { force: true }); throw error; }
}
export async function storeUpload(file: File) {
  if (file.size > getConfig().uploadMaxBytes) throw new AppError('TOO_LARGE', 413, 'The file exceeds the upload limit.');
  return storeReadable(Readable.fromWeb(file.stream() as import('node:stream/web').ReadableStream), file.name);
}
export async function removeStoredFile(key: string) { await fs.rm(storagePath(key), { force: true }); }
export async function openStoredFile(key: string) {
  const file = storagePath(key);
  try { const stat = await fs.stat(file); if (!stat.isFile()) throw new Error('missing'); return Readable.toWeb(createReadStream(file)) as ReadableStream; }
  catch { throw new AppError('FILE_MISSING', 404, 'This binary is unavailable. Please contact your administrator.'); }
}
export async function readMultipart(request: Request): Promise<{ fields: Record<string, string>; file: StoredFile }> {
  if (!request.body) throw new AppError('VALIDATION', 400, 'Select a file to upload.');
  const config = getConfig();
  const declared = Number(request.headers.get('content-length'));
  if (declared > config.uploadMaxBytes + 65536) throw new AppError('TOO_LARGE', 413, 'The upload exceeds the limit.');
  let parser: ReturnType<typeof Busboy>;
  try { parser = Busboy({ headers: Object.fromEntries(request.headers), limits: { files: 1, fields: 5, fieldSize: 20000, fileSize: config.uploadMaxBytes } }); }
  catch { throw new AppError('VALIDATION', 400, 'Invalid multipart upload.'); }
  const fields: Record<string, string> = {};
  let fileTask: Promise<StoredFile> | undefined;
  let invalid = false;
  let stored: StoredFile | undefined;
  parser.on('field', (name, value, info) => { if (info.valueTruncated || Object.hasOwn(fields, name)) invalid = true; fields[name] = value; });
  parser.on('file', (name, stream, info) => {
    if (name !== 'file' || fileTask) { invalid = true; stream.resume(); return; }
    stream.on('limit', () => { invalid = true; });
    fileTask = storeReadable(stream, info.filename).then(file => { stored = file; return file; });
    // Attach immediately: stream errors must not become unhandled rejections before parser completion.
    void fileTask.catch(() => {});
  });
  parser.on('filesLimit', () => { invalid = true; });
  parser.on('fieldsLimit', () => { invalid = true; });
  let total = 0;
  const bound = new Transform({ transform(chunk: Buffer, _encoding, callback) { total += chunk.length; callback(total > config.uploadMaxBytes + 65536 ? new AppError('TOO_LARGE', 413, 'The upload exceeds the limit.') : null, chunk); } });
  try {
    await pipeline(Readable.fromWeb(request.body as import('node:stream/web').ReadableStream), bound, parser);
    if (!fileTask) throw new AppError('VALIDATION', 400, 'Select one file to upload.');
    const file = await fileTask;
    if (invalid) throw new AppError('VALIDATION', 400, 'Upload contains too many fields/files or exceeds the size limit.');
    return { fields, file };
  } catch (error) {
    if (fileTask) await fileTask.catch(() => {});
    if (stored) await removeStoredFile(stored.key);
    throw error;
  }
}
export async function readMultipartImage(request: Request): Promise<{ path: string; filename: string; contentType: string; size: number }> {
  const maxBytes = 2 * 1024 * 1024;
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    throw new AppError('VALIDATION', 400, 'Invalid image upload.');
  }
  const file = formData.get('file');
  if (!file || !(file instanceof File) || file.size === 0) {
    throw new AppError('VALIDATION', 400, 'Select an image file to upload.');
  }
  if (file.size > maxBytes) {
    throw new AppError('TOO_LARGE', 413, 'Image must be under 2 MB.');
  }
  const safeFile = safeFilename(file.name || 'icon.png');
  const ext = safeFile.split('.').pop()?.toLowerCase() || 'png';
  const mimeFromExt: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml' };
  const contentType = (file.type && file.type !== 'application/octet-stream')
    ? file.type
    : (mimeFromExt[ext] ?? 'image/png');
  if (!contentType.startsWith('image/')) {
    throw new AppError('VALIDATION', 400, 'File must be an image (PNG, JPG, WebP, GIF, SVG).');
  }
  const config = getConfig();
  await fs.mkdir(config.uploadDir, { recursive: true });
  const tmpPath = path.join(config.uploadDir, `img-${randomUUID()}.tmp`);
  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(tmpPath, buffer);
  return { path: tmpPath, filename: safeFile, contentType, size: buffer.length };
}
