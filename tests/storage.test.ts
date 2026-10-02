import { beforeEach, it, expect } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { storeUpload, removeStoredFile, safeFilename, attachmentHeader } from '@/server/storage';
import { storeReadable, readMultipart } from '@/server/storage';
import { Readable } from 'node:stream';
beforeEach(async () => { await fs.mkdir('./data/test-uploads', { recursive: true }); });
it('stores binaries under generated keys and sanitizes filenames', async () => {
  const stored = await storeUpload(new File(['test'], '../../app.apk'));
  expect(stored.key).toMatch(/^[a-f0-9-]+$/);
  expect(stored.filename).toBe('app.apk');
  expect(stored.size).toBe(4);
  expect(stored.checksum).toBe('9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08');
  expect(await fs.readFile(path.resolve('data/test-uploads', stored.key), 'utf8')).toBe('test');
  await removeStoredFile(stored.key);
});
it('rejects unsafe keys, empty and invalid extensions', async () => {
  await expect(removeStoredFile('../escape')).rejects.toThrow();
  await expect(storeUpload(new File(['evil'], 'app.apk.exe.js'))).rejects.toThrow();
  await expect(storeUpload(new File([], 'empty.apk'))).rejects.toThrow();
  expect(safeFilename('..\\résumé.apk')).toBe('résumé.apk');
  expect(attachmentHeader('a\r\n.apk')).not.toContain('\r');
  const archive = await storeUpload(new File(['archive'], 'BUILD.TAR.GZ'));
  await removeStoredFile(archive.key);
});
it('enforces configured upload size', async () => {
  const prior = process.env.UPLOAD_MAX_MB;
  process.env.UPLOAD_MAX_MB = '1';
  try { await expect(storeUpload(new File([new Uint8Array(1048577)], 'large.apk'))).rejects.toThrow(); }
  finally { if (prior === undefined) delete process.env.UPLOAD_MAX_MB; else process.env.UPLOAD_MAX_MB = prior; }
});
it('cleans staged data after an interrupted stream', async () => {
  const before = await fs.readdir('data/test-uploads');
  const source = Readable.from((async function* () { yield Buffer.from('partial'); throw new Error('Connection interrupted'); })());
  await expect(storeReadable(source, 'app.apk')).rejects.toThrow('Connection interrupted');
  expect(await fs.readdir('data/test-uploads')).toEqual(before);
});
it('cleans multipart files when the parser rejects a second binary', async () => {
  const before = await fs.readdir('data/test-uploads');
  const form = new FormData(); form.set('version', '1.0'); form.append('file', new File(['first'], 'app.apk')); form.append('file', new File(['second'], 'other.apk'));
  await expect(readMultipart(new Request('http://localhost:3000/upload', { method: 'POST', body: form }))).rejects.toThrow();
  expect(await fs.readdir('data/test-uploads')).toEqual(before);
});
