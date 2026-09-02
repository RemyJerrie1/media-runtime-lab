import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { MediaAsset } from '@media-lab/contracts';
import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
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
    };
    await writeFile(resolve(this.uploads, `${id}.json`), JSON.stringify({ ...asset, storedName }));
    return asset;
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
