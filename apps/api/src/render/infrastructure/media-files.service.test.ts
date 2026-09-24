import { afterEach, expect, test, vi } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { MediaFilesService } from './media-files.service';

const roots: string[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});
test('corrupt receipts cannot select other files and replacement uploads remain usable', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'media-receipt-'));
  roots.push(root);
  vi.spyOn(process, 'cwd').mockReturnValue(root);
  const files = new MediaFilesService();
  const upload = {
    mimetype: 'video/mp4',
    originalname: 'sample.mp4',
    buffer: Buffer.from('media'),
    size: 5,
  } as Express.Multer.File;
  const asset = await files.saveUpload(upload);
  const receipt = resolve(root, '.runtime/uploads', `${asset.id}.json`);
  const valid = JSON.parse(await readFile(receipt, 'utf8'));
  for (const corrupt of [
    '{',
    'null',
    JSON.stringify({ ...valid, storedName: '../../secret' }),
    JSON.stringify({ ...valid, id: crypto.randomUUID() }),
    JSON.stringify({ ...valid, mimeType: 42 }),
    JSON.stringify({ ...valid, sizeBytes: 999 }),
    ' '.repeat(65537),
  ]) {
    await writeFile(receipt, corrupt);
    await expect(files.sourcePath(asset.id)).rejects.toThrow('ASSET_NOT_FOUND');
    await expect(files.source(asset.id)).rejects.toThrow('ASSET_NOT_FOUND');
  }
  await expect(files.sourcePath('../secret')).rejects.toThrow('ASSET_NOT_FOUND');
  await expect(files.streamAsset(asset.id, '..')).rejects.toThrow('STREAM_ASSET_NOT_FOUND');
  const replacement = await files.saveUpload(upload);
  expect((await files.source(replacement.id)).size).toBe(5);
  await writeFile(receipt, JSON.stringify(valid));
  expect((await files.source(asset.id)).mimeType).toBe('video/mp4');
});
