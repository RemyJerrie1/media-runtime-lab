import { createHash, randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, writeFile, rename, rm, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import ffmpeg from 'ffmpeg-static';
import ffprobe from '@ffprobe-installer/ffprobe';
import {
  SCENE_AUDIO_MAX_BYTES,
  sceneAudioAssetSchema,
  type SceneAudioAsset,
} from '@media-lab/contracts';
import { startSceneProcess } from './scene-process';

export class FileSceneAudioAssets {
  constructor(private root = resolve(process.cwd(), '.runtime/scene-audio')) {}
  private directory(id: string) {
    if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(id))
      throw new Error('SCENE_AUDIO_MISSING');
    return resolve(this.root, id);
  }
  async get(id: string, tenant?: string): Promise<SceneAudioAsset> {
    try {
      const record = JSON.parse(await readFile(resolve(this.directory(id), 'asset.json'), 'utf8'));
      if (tenant !== undefined && record.tenant !== tenant) throw new Error('SCENE_AUDIO_MISSING');
      const asset = sceneAudioAssetSchema.parse(record.asset);
      if (
        asset.id !== id ||
        (await stat(resolve(this.directory(id), 'audio.wav'))).size !== asset.sizeBytes
      )
        throw new Error('SCENE_AUDIO_MISSING');
      return asset;
    } catch {
      throw new Error('SCENE_AUDIO_MISSING');
    }
  }
  async resolve(asset: SceneAudioAsset, tenant?: string) {
    const stored = await this.get(asset.id, tenant);
    if (JSON.stringify(stored) !== JSON.stringify(sceneAudioAssetSchema.parse(asset)))
      throw new Error('SCENE_AUDIO_CHANGED');
    const path = resolve(this.directory(asset.id), 'audio.wav');
    if (
      `sha256:${createHash('sha256')
        .update(await readFile(path))
        .digest('hex')}` !== asset.checksum
    )
      throw new Error('SCENE_AUDIO_CHANGED');
    return path;
  }
  async save(bytes: Buffer, tenant: string): Promise<SceneAudioAsset> {
    if (!bytes.length || bytes.length > SCENE_AUDIO_MAX_BYTES) throw new Error('SCENE_AUDIO_SIZE');
    await mkdir(this.root, { recursive: true });
    const temporary = await mkdtemp(resolve(this.root, 'upload-'));
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error('SCENE_AUDIO_TIMEOUT')), 15000);
    try {
      const source = resolve(temporary, 'source');
      await writeFile(source, bytes);
      const probe = startSceneProcess(
        process.env.FFPROBE_BINARY ?? ffprobe.path,
        ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', source],
        controller.signal,
      );
      const metadata = JSON.parse((await probe.done).toString());
      const duration = Number(metadata.format?.duration);
      if (
        !['mp3', 'wav'].includes(metadata.format?.format_name) ||
        metadata.streams?.length !== 1 ||
        metadata.streams[0].codec_type !== 'audio' ||
        !Number.isFinite(duration) ||
        duration <= 0 ||
        duration > 60
      )
        throw new Error('SCENE_AUDIO_FORMAT');
      const output = resolve(temporary, 'audio.wav');
      const convert = startSceneProcess(
        process.env.FFMPEG_BINARY ?? ffmpeg!,
        [
          '-v',
          'error',
          '-xerror',
          '-i',
          source,
          '-map',
          '0:a:0',
          '-vn',
          '-map_metadata',
          '-1',
          '-ar',
          '48000',
          '-ac',
          '2',
          '-c:a',
          'pcm_s16le',
          '-t',
          '60',
          output,
        ],
        controller.signal,
      );
      await convert.done;
      const content = await readFile(output);
      const normalized = startSceneProcess(
        process.env.FFPROBE_BINARY ?? ffprobe.path,
        ['-v', 'error', '-show_format', '-of', 'json', output],
        controller.signal,
      );
      const measured = JSON.parse((await normalized.done).toString());
      const id = randomUUID();
      const asset = sceneAudioAssetSchema.parse({
        id,
        checksum: `sha256:${createHash('sha256').update(content).digest('hex')}`,
        durationSeconds: Number(measured.format.duration),
        sizeBytes: content.length,
        url: `/scene-audio/${id}.wav`,
      });
      await rm(source);
      await writeFile(resolve(temporary, 'asset.json'), JSON.stringify({ tenant, asset }));
      controller.signal.throwIfAborted();
      await rename(temporary, this.directory(id));
      return asset;
    } finally {
      clearTimeout(timer);
      await rm(temporary, { recursive: true, force: true });
    }
  }
}
