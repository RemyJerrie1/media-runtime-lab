import { beforeAll, afterAll, it, expect } from 'vitest';
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import ffmpeg from 'ffmpeg-static';
import { FileSceneAudioAssets } from './scene-audio-assets';
import { startSceneProcess } from './scene-process';
import { ChromiumSceneProcessor } from './chromium-scene.processor';
import { newSceneJob } from '../domain/scene-workflow';
import { sceneCommand } from './scene-fixture';
import { createSceneRenderSchema } from '@media-lab/contracts';

function wave(seconds = 3) {
  const rate = 48000,
    samples = rate * seconds;
  const bytes = Buffer.alloc(44 + samples * 2);
  bytes.write('RIFF', 0);
  bytes.writeUInt32LE(bytes.length - 8, 4);
  bytes.write('WAVEfmt ', 8);
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20);
  bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(rate, 24);
  bytes.writeUInt32LE(rate * 2, 28);
  bytes.writeUInt16LE(2, 32);
  bytes.writeUInt16LE(16, 34);
  bytes.write('data', 36);
  bytes.writeUInt32LE(samples * 2, 40);
  for (let i = rate / 2; i < samples; i++)
    bytes.writeInt16LE(Math.round(16000 * Math.sin((2 * Math.PI * 440 * i) / rate)), 44 + i * 2);
  return bytes;
}
let root: string;
let assets: FileSceneAudioAssets;
const signal = () => new AbortController().signal;
const binary = process.env.FFMPEG_BINARY ?? ffmpeg!;
beforeAll(async () => {
  await mkdir('.runtime', { recursive: true });
  root = await mkdtemp(resolve('.runtime/audio-test-'));
  assets = new FileSceneAudioAssets(resolve(root, 'assets'));
});
afterAll(async () => {
  if (root.startsWith(resolve('.runtime') + sep + 'audio-test-'))
    await rm(root, { recursive: true, force: true });
});
it('persists verified WAV and MP3 across instances, scopes ownership and rejects metadata/content tampering', async () => {
  const asset = await assets.save(wave(), 'tenant-a');
  const reopened = new FileSceneAudioAssets(resolve(root, 'assets'));
  expect(await reopened.get(asset.id, 'tenant-a')).toEqual(asset);
  await expect(reopened.resolve(asset, 'tenant-b')).rejects.toThrow('SCENE_AUDIO_MISSING');
  await expect(reopened.resolve({ ...asset, durationSeconds: 2 })).rejects.toThrow(
    'SCENE_AUDIO_CHANGED',
  );
  const source = await reopened.resolve(asset);
  const mp3 = resolve(root, 'sample.mp3');
  await startSceneProcess(
    binary,
    ['-v', 'error', '-i', source, '-c:a', 'libmp3lame', mp3],
    signal(),
  ).done;
  expect((await assets.save(await readFile(mp3), 'tenant-a')).durationSeconds).toBeCloseTo(3, 1);
  await writeFile(source, Buffer.alloc(asset.sizeBytes));
  await expect(reopened.resolve(asset)).rejects.toThrow('SCENE_AUDIO_CHANGED');
}, 30000);
it('rejects invalid, oversized, overlong and non-audio uploads without leaving upload directories', async () => {
  await expect(assets.save(Buffer.from('not audio'), 'a')).rejects.toThrow();
  await expect(assets.save(Buffer.alloc(10 * 1024 * 1024 + 1), 'a')).rejects.toThrow(
    'SCENE_AUDIO_SIZE',
  );
  await expect(assets.save(wave(61), 'a')).rejects.toThrow('SCENE_AUDIO_FORMAT');
  const movie = resolve(root, 'not-audio.mp4');
  await startSceneProcess(
    binary,
    ['-v', 'error', '-f', 'lavfi', '-i', 'color=s=16x16:d=0.1', '-c:v', 'libx264', movie],
    signal(),
  ).done;
  await expect(assets.save(await readFile(movie), 'a')).rejects.toThrow('SCENE_AUDIO_FORMAT');
  expect(
    (await readdir(resolve(root, 'assets'))).filter((name) => name.startsWith('upload-')),
  ).toEqual([]);
}, 30000);
// Each case renders one complete movie. A software-rendered CI host must not
// squeeze three independent exports into one job's 120-second budget.
it.each(['delayed', 'muted', 'clipped'] as const)(
  'renders and decodes the %s audio case within one export budget',
  async (mode) => {
    const asset = await assets.save(wave(), 'a');
    const base = sceneCommand();
    const command = createSceneRenderSchema.parse({
      ...base,
      scene: {
        ...base.scene,
        version: 4,
        audio: {
          asset,
          trimStart: 0.5,
          start: mode === 'clipped' ? 4 : 1,
          volume: 0.5,
          muted: mode === 'muted',
        },
      },
    });
    const movies = resolve(root, 'movies-' + mode);
    const processor = new ChromiumSceneProcessor({
      root: movies,
      audioAssets: assets,
      timeoutMs: 110000,
    });
    const receipt = await processor.render(newSceneJob(command), signal(), async () => {});
    expect(receipt.durationSeconds).toBeCloseTo(5, 2);
    expect(receipt.audioStreams).toBe(mode === 'muted' ? 0 : 1);
    const decode = async (path: string) =>
      await startSceneProcess(
        binary,
        ['-v', 'error', '-i', path, '-vn', '-ac', '1', '-ar', '48000', '-f', 'f32le', 'pipe:1'],
        signal(),
      ).done;
    function rms(bytes: Buffer, start: number, end: number) {
      let sum = 0;
      for (let i = Math.floor(start * 48000); i < Math.floor(end * 48000); i++)
        sum += bytes.readFloatLE(i * 4) ** 2;
      return Math.sqrt(sum / ((end - start) * 48000));
    }
    if (mode !== 'muted') {
      const pcm = await decode(resolve(movies, receipt.artifactUrl.split('/').at(-1)!));
      if (mode === 'delayed') {
        const source = await decode(await assets.resolve(asset));
        expect(rms(pcm, 0.1, 0.9)).toBeLessThan(0.001);
        expect(rms(pcm, 3.7, 4.9)).toBeLessThan(0.001);
        expect(rms(pcm, 1.2, 2.2) / rms(source, 1, 2)).toBeCloseTo(0.5, 1);
        let onset = 0;
        for (let i = 0; i < pcm.length / 4; i++)
          if (Math.abs(pcm.readFloatLE(i * 4)) > 0.01) {
            onset = i / 48000;
            break;
          }
        expect(Math.abs(onset - 1)).toBeLessThan(1 / 24);
      } else {
        expect(rms(pcm, 0.1, 3.8)).toBeLessThan(0.001);
        expect(rms(pcm, 4.2, 4.9)).toBeGreaterThan(0.1);
        // AAC packet padding must not extend the timeline by a video frame.
        expect(pcm.length / 4 / 48000).toBeLessThan(5 + 1 / 24);
      }
    }
    await processor.discard(receipt);
    expect(await readdir(movies)).toEqual([]);
  },
  120000,
);
