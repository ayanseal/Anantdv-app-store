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
function storagePath(key: string) {
  if (!/^[a-f0-9-]{36}$/.test(key)) throw new AppError('FILE', 400, 'Invalid file key.');
  return path.join(getConfig().uploadDir, key);
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
