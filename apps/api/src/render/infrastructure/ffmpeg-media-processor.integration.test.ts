import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import ffmpeg from 'ffmpeg-static';
import ffprobe from '@ffprobe-installer/ffprobe';
import { FfmpegMediaProcessor } from './ffmpeg-media-processor';
import { MediaFilesService } from './media-files.service';
import { InMemoryWorkflowStore } from './in-memory-render.repository';
import type { RenderJob } from '@media-lab/contracts';

const execute = promisify(execFile);
const binary = process.env.FFMPEG_BINARY || ffmpeg!;
const probeBinary = process.env.FFPROBE_BINARY || ffprobe.path;

describe('real FFmpeg delivery', () => {
  let root: string;
  let input: string;
  let processor: FfmpegMediaProcessor;
  let job: RenderJob;
  const outputIds = new Set<string>();
  const testRoot = resolve(process.cwd(), '.runtime');
  beforeAll(async () => {
    await mkdir(testRoot, { recursive: true });
    root = await mkdtemp(resolve(testRoot, 'media-test-'));
    input = resolve(root, 'input.mp4');
    await execute(binary, [
      '-y',
      '-f',
      'lavfi',
      '-i',
      'color=c=black:s=640x360:r=15',
      '-f',
      'lavfi',
      '-i',
      'sine=frequency=440:sample_rate=44100',
      '-t',
      '3',
      '-vf',
      "drawbox=color=white:t=fill:enable='lt(t,1)'",
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      input,
    ]);
    const files = {
      initialize: async () => {},
      sourcePath: async () => input,
      artifactPath: (id: string) => resolve(root, `${id}.mp4`),
      streamDirectory: async (id: string) => {
        const directory = resolve(root, id);
        await mkdir(directory, { recursive: true });
        return directory;
      },
      checksum: MediaFilesService.prototype.checksum,
    };
    processor = new FfmpegMediaProcessor(files);
    const store = new InMemoryWorkflowStore();
    ({ job } = await store.create({
      tenantId: 'media-test',
      traceId: 'trace',
      requestId: 'request',
      quotaTokens: 50000,
      command: {
        projectId: 'media-test',
        sourceAssetId: crypto.randomUUID(),
        template: 'landscape',
        trimStartSeconds: 1,
        durationSeconds: 1,
        encoding: {
          codec: 'libx264',
          preset: 'ultrafast',
          rateControl: 'crf',
          crf: 18,
          bitrateKbps: 600,
          gop: 24,
          fps: 24,
        },
        processing: {
          frameRateMode: 'cfr',
          audioSampleRate: 48000,
          audioSync: 'async-resample',
          subtitleMode: 'none',
          watermarkMode: 'visible',
          adInsertion: 'none',
          fastStart: true,
          deliveryFormat: 'hls-cmaf',
          abrLadder: 'none',
          qualityMetric: 'none',
        },
        narration: 'real media test',
        idempotencyKey: crypto.randomUUID(),
      },
    }));
  }, 30000);
  afterAll(async () => {
    if (root && root.startsWith(`${testRoot}${sep}media-test-`))
      await rm(root, { recursive: true, force: true });
  });

  async function checkVideo(path: string) {
    const { stdout } = await execute(probeBinary, [
      '-v',
      'error',
      '-show_streams',
      '-show_format',
      '-of',
      'json',
      path,
    ]);
    const probe = JSON.parse(stdout);
    const video = probe.streams.find(
      (stream: { codec_type: string }) => stream.codec_type === 'video',
    );
    const audio = probe.streams.find(
      (stream: { codec_type: string }) => stream.codec_type === 'audio',
    );
    expect(video.avg_frame_rate).toBe('24/1');
    expect(audio.sample_rate).toBe('48000');
    expect(Number(probe.format.duration)).toBeGreaterThanOrEqual(0.9);
    expect(Number(probe.format.duration)).toBeLessThan(1.2);
    // The first source second is white; after trimming only the watermark should be bright.
    const frame = await execute(
      binary,
      ['-v', 'error', '-i', path, '-frames:v', '1', '-vf', 'format=gray', '-f', 'rawvideo', '-'],
      { encoding: 'buffer', maxBuffer: 8 * 1024 * 1024 },
    );
    const brightPixels = [...frame.stdout].filter((value) => value > 180).length;
    expect(brightPixels).toBeGreaterThan(100);
    expect(brightPixels).toBeLessThan(5000);
  }

  it.each(['none', 'standard'] as const)(
    'preserves watermark, trim, fps and audio with ABR=%s',
    async (abrLadder) => {
      const receipt = await processor.render({
        ...job,
        processing: { ...job.processing, abrLadder },
      });
      expect(receipt.renditions).toHaveLength(abrLadder === 'none' ? 1 : 4);
      expect(receipt.evidence?.probe).toMatchObject({ fps: 24 });
      expect(receipt.evidence?.probe.durationSeconds).toBeLessThan(1.2);
      expect(receipt.evidence?.playbackVerified).toBe(true);
      const outputId = receipt.manifestUrl!.split('/')[2]!;
      expect(outputId).not.toBe(job.id);
      expect(outputIds.has(outputId)).toBe(false);
      outputIds.add(outputId);
      await checkVideo(resolve(root, `${outputId}.mp4`));
      const master = await readFile(resolve(root, outputId, 'master.m3u8'), 'utf8');
      for (const rendition of receipt.renditions) {
        expect(master).toContain(`${rendition.id}.m3u8`);
        const playlist = resolve(root, outputId, `${rendition.id}.m3u8`);
        const text = await readFile(playlist, 'utf8');
        expect(text).toContain(`URI="${rendition.id}-init.mp4"`);
        expect(text).not.toContain(root);
        await checkVideo(playlist);
      }
    },
    60000,
  );

  it('does not start media processing with an already-lost lease', async () => {
    await expect(processor.render(job, AbortSignal.abort(new Error('lease lost')))).rejects.toThrow(
      'lease lost',
    );
  });
  it('aborts an active media process without returning a receipt', async () => {
    const controller = new AbortController();
    const pending = processor.render(job, controller.signal);
    const timer = setTimeout(
      () => controller.abort(new Error('lease expired during media processing')),
      25,
    );
    try {
      await expect(pending).rejects.toThrow('lease expired during media processing');
    } finally {
      clearTimeout(timer);
    }
  });
});
