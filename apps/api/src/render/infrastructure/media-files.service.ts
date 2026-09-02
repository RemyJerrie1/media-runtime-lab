import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { MediaAsset } from '@media-lab/contracts';
import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { resolve } from 'node:path';

const ALLOWED = new Map([
  ['video/mp4', '.mp4'],
  ['video/quicktime', '.mov'],
  ['video/webm', '.webm'],
  ['video/x-matroska', '.mkv'],
]);

@Injectable()
export class MediaFilesService {
  private readonly root = resolve(process.cwd(), '.runtime');
  private readonly uploads = resolve(this.root, 'uploads');
  private readonly artifacts = resolve(this.root, 'artifacts');

  async initialize() {
    await Promise.all([
      mkdir(this.uploads, { recursive: true }),
      mkdir(this.artifacts, { recursive: true }),
    ]);
  }

  async saveUpload(file: Express.Multer.File): Promise<MediaAsset> {
    const extension = ALLOWED.get(file.mimetype);
    if (!extension || !file.buffer.length) throw new BadRequestException('UNSUPPORTED_MEDIA_FILE');
    await this.initialize();
    const id = crypto.randomUUID();
    const storedName = `${id}${extension}`;
    await writeFile(resolve(this.uploads, storedName), file.buffer, { flag: 'wx' });
    const asset = {
      id,
      fileName: file.originalname,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      url: `/media/${id}`,
    };
    await writeFile(resolve(this.uploads, `${id}.json`), JSON.stringify({ ...asset, storedName }));
    return asset;
  }

  async provisionDemo(): Promise<MediaAsset> {
    await this.initialize();
    const id = '00000000-0000-4000-8000-000000000001';
    const storedName = `${id}.mp4`;
    const destination = resolve(this.uploads, storedName);
    if (!(await stat(destination).catch(() => undefined))) {
      const source = await this.firstExisting([
        resolve(process.cwd(), 'docs/media/product-demo.mp4'),
        resolve(process.cwd(), '../../docs/media/product-demo.mp4'),
      ]);
      await copyFile(source, destination);
    }
    const details = await stat(destination);
    const asset = {
      id,
      fileName: '媒體運行實驗室示範影片.mp4',
      mimeType: 'video/mp4',
      sizeBytes: details.size,
      url: `/media/${id}`,
    };
    await writeFile(resolve(this.uploads, `${id}.json`), JSON.stringify({ ...asset, storedName }));
    return asset;
  }

  async source(id: string) {
    const path = await this.sourcePath(id);
    const metadata = JSON.parse(
      await readFile(resolve(this.uploads, `${id}.json`), 'utf8'),
    ) as MediaAsset;
    const details = await stat(path);
    return {
      path,
      size: details.size,
      mimeType: metadata.mimeType,
      stream: () => createReadStream(path),
    };
  }

  private async firstExisting(paths: string[]) {
    for (const path of paths) {
      if (await stat(path).catch(() => undefined)) return path;
    }
    throw new NotFoundException('DEMO_MEDIA_NOT_FOUND');
  }

  async sourcePath(id: string) {
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new NotFoundException('ASSET_NOT_FOUND');
    const metadataText = await readFile(resolve(this.uploads, `${id}.json`), 'utf8').catch(() => {
      throw new NotFoundException('ASSET_NOT_FOUND');
    });
    const metadata = JSON.parse(metadataText) as { storedName: string };
    return resolve(this.uploads, metadata.storedName);
  }

  artifactPath(jobId: string) {
    if (!/^[0-9a-f-]{36}$/i.test(jobId)) throw new NotFoundException('ARTIFACT_NOT_FOUND');
    return resolve(this.artifacts, `${jobId}.mp4`);
  }

  async artifact(jobId: string) {
    const path = this.artifactPath(jobId);
    const details = await stat(path).catch(() => {
      throw new NotFoundException('ARTIFACT_NOT_FOUND');
    });
    return { path, size: details.size, stream: () => createReadStream(path) };
  }

  async checksum(path: string) {
    return `sha256:${createHash('sha256')
      .update(await readFile(path))
      .digest('hex')}`;
  }
}
