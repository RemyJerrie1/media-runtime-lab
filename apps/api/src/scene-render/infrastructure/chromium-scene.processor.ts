import { mediaProbeSchema } from '../../shared/media-probe';
import { chromium, type Browser } from 'playwright';
import { type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, rename, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import ffmpeg from 'ffmpeg-static';
import ffprobe from '@ffprobe-installer/ffprobe';
import {
  audibleSceneAudio,
  sceneReceiptSchema,
  type SceneRenderJob,
  type SceneReceipt,
} from '@media-lab/contracts';
import type { SceneProcessor } from '../domain/scene-workflow';

import { startSceneProcess } from './scene-process';
import { FileSceneAudioAssets } from './scene-audio-assets';
export { startSceneProcess } from './scene-process';

export const sceneArtifactRoot = () => resolve(process.cwd(), '.runtime/scene-artifacts');
type Options = {
  root?: string;
  audioAssets?: FileSceneAudioAssets;
  fontPath?: string;
  timeoutMs?: number;
  chromiumArgs?: string[];
  encoder?: string;
};
type Capture = {
  init(scene: unknown, rendererVersion: string): Promise<void>;
  frame(index: number): string;
};
async function writeFrame(
  child: ChildProcessWithoutNullStreams,
  buffer: Buffer,
  signal: AbortSignal,
) {
  signal.throwIfAborted();
  await new Promise<void>((resolve, reject) =>
    child.stdin.write(buffer, (error) => (error ? reject(error) : resolve())),
  );
}

export class ChromiumSceneProcessor implements SceneProcessor {
  constructor(private options: Options = {}) {}
  async discard(receipt: SceneReceipt) {
    const id = receipt.artifactUrl.match(/^\/scene-artifacts\/([a-f0-9-]{36})\.mp4$/)?.[1];
    if (!id) throw new Error('INVALID_SCENE_ARTIFACT');
    await rm(resolve(this.options.root ?? sceneArtifactRoot(), `${id}.mp4`), { force: true });
  }
  async render(
    job: SceneRenderJob,
    external: AbortSignal,
    progress: (frames: number, encoding: boolean) => Promise<void>,
  ): Promise<SceneReceipt> {
    const root = this.options.root ?? sceneArtifactRoot();
    await mkdir(root, { recursive: true });
    const directory = await mkdtemp(resolve(root, 'attempt-'));
    let temporary = resolve(directory, 'output.mp4');
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(new Error('SCENE_RENDER_TIMEOUT')),
      this.options.timeoutMs ?? 120000,
    );
    const signal = AbortSignal.any([external, controller.signal]);
    let browser: Browser | undefined;
    let encoder: ReturnType<typeof startSceneProcess> | undefined;
    const closeBrowser = () => {
      void browser?.close().catch(() => {});
    };
    signal.addEventListener('abort', closeBrowser, { once: true });
    try {
      signal.throwIfAborted();
      const audio = audibleSceneAudio(job.scene);
      const audioPath = audio
        ? await (this.options.audioAssets ?? new FileSceneAudioAssets()).resolve(audio.asset)
        : null;
      const font = await readFile(
        this.options.fontPath ?? require.resolve('@media-lab/scene-renderer/font.ttf'),
      ).catch(() => {
        throw new Error('SCENE_FONT_UNAVAILABLE');
      });
      const script = await readFile(
        require.resolve('@media-lab/scene-renderer/capture.js'),
        'utf8',
      );
      const model =
        job.rendererVersion === 'hamster-3'
          ? await readFile(require.resolve('@media-lab/scene-renderer/hamster.glb'))
          : null;
      const environment = model
        ? await readFile(require.resolve('@media-lab/scene-renderer/studio-env.bin'))
        : null;
      browser = await chromium.launch({
        headless: true,
        timeout: 20000,
        args: this.options.chromiumArgs ?? [
          '--use-angle=swiftshader',
          '--enable-unsafe-swiftshader',
        ],
      });
      signal.throwIfAborted();
      const page = await browser.newPage({
        viewport: { width: 640, height: 360 },
        deviceScaleFactor: 1,
      });
      page.setDefaultTimeout(15000);
      await page.route('**/*', async (route) => {
        const url = route.request().url();
        if (url === 'http://scene-render.invalid/')
          await route.fulfill({
            contentType: 'text/html',
            body: '<!doctype html><body><script src="/capture.js"></script></body>',
          });
        else if (url === 'http://scene-render.invalid/capture.js')
          await route.fulfill({ contentType: 'text/javascript', body: script });
        else if (url === 'http://scene-render.invalid/models/hamster-3.glb' && model)
          await route.fulfill({ contentType: 'model/gltf-binary', body: model });
        else if (url === 'http://scene-render.invalid/models/hamster-3-studio.bin' && environment)
          await route.fulfill({ contentType: 'application/octet-stream', body: environment });
        else if (url === 'http://scene-render.invalid/fonts/NotoSansTC.ttf')
          await route.fulfill({ contentType: 'font/ttf', body: font });
        else await route.abort();
      });
      await page.goto('http://scene-render.invalid/');
      await page.evaluate(
        (input) =>
          (window as unknown as { sceneCapture: Capture }).sceneCapture.init(
            input.scene,
            input.rendererVersion,
          ),
        { scene: job.scene, rendererVersion: job.rendererVersion },
      );
      const binary = this.options.encoder ?? process.env.FFMPEG_BINARY ?? ffmpeg!;
      encoder = startSceneProcess(
        binary,
        [
          '-hide_banner',
          '-loglevel',
          'error',
          '-f',
          'image2pipe',
          '-framerate',
          '24',
          '-vcodec',
          'png',
          '-i',
          'pipe:0',
          '-an',
          '-frames:v',
          '120',
          '-c:v',
          'libx264',
          '-threads',
          '1',
          '-preset',
          'fast',
          '-crf',
          '18',
          '-pix_fmt',
          'yuv420p',
          '-movflags',
          '+faststart',
          temporary,
        ],
        signal,
      );
      for (let index = 0; index < 120; index++) {
        signal.throwIfAborted();
        const png = await page.evaluate(
          (index) => (window as unknown as { sceneCapture: Capture }).sceneCapture.frame(index),
          index,
        );
        await writeFrame(encoder.child, Buffer.from(png, 'base64'), signal);
        // Report real completed frames; never a synthetic timer-based percentage.
        if ((index + 1) % 6 === 0) await progress(index + 1, false);
      }
      encoder.child.stdin.end();
      await progress(120, true);
      await encoder.done;
      signal.throwIfAborted();
      if (audio && audioPath) {
        const mixed = resolve(directory, 'mixed.mp4');
        // Rebase the FINAL samples too: AAC muxing can otherwise discard leading delay
        // after trimming. Decoded-onset regression tests guard this across FFmpeg versions.
        const filter = `atrim=start_sample=${Math.round(audio.trimStart * 48000)},asetpts=N/SR/TB,volume=${audio.volume},adelay=${Math.round(audio.start * 48000)}S:all=1,apad,atrim=end_sample=240000,asetpts=N/SR/TB`;
        const mux = startSceneProcess(
          binary,
          [
            '-v',
            'error',
            '-i',
            temporary,
            '-i',
            audioPath,
            '-map',
            '0:v:0',
            '-map',
            '1:a:0',
            '-c:v',
            'copy',
            '-af',
            filter,
            '-c:a',
            'aac',
            '-b:a',
            '192k',
            '-ar',
            '48000',
            '-ac',
            '2',
            '-t',
            '5',
            '-movflags',
            '+faststart',
            mixed,
          ],
          signal,
        );
        await mux.done;
        temporary = mixed;
      }
      const probe = startSceneProcess(
        process.env.FFPROBE_BINARY ?? ffprobe.path,
        ['-v', 'error', '-count_frames', '-show_streams', '-show_format', '-of', 'json', temporary],
        signal,
      );
      const metadata = mediaProbeSchema.parse(JSON.parse((await probe.done).toString()));
      const stream = metadata.streams[0];
      if (
        metadata.streams.length !== (audio ? 2 : 1) ||
        (audio !== null &&
          (metadata.streams[1]?.codec_name !== 'aac' ||
            metadata.streams[1]?.sample_rate !== '48000' ||
            metadata.streams[1]?.channels !== 2)) ||
        stream?.codec_type !== 'video' ||
        stream.codec_name !== 'h264' ||
        stream.width !== 640 ||
        stream.height !== 360 ||
        stream.avg_frame_rate !== '24/1' ||
        Number(stream.nb_read_frames) !== 120
      )
        throw new Error('SCENE_INVALID_OUTPUT');
      const decode = startSceneProcess(
        binary,
        ['-v', 'error', '-xerror', '-i', temporary, '-f', 'null', '-'],
        signal,
      );
      await decode.done;
      const artifactId = randomUUID();
      const receipt = sceneReceiptSchema.parse({
        version: 1,
        rendererVersion: job.rendererVersion,
        sceneFingerprint: job.sceneFingerprint,
        artifactUrl: `/scene-artifacts/${artifactId}.mp4`,
        width: 640,
        height: 360,
        fps: 24,
        frameCount: 120,
        durationSeconds: Number(metadata.format.duration),
        audioStreams: audio ? 1 : 0,
        sizeBytes: (await stat(temporary)).size,
        checksum: `sha256:${createHash('sha256')
          .update(await readFile(temporary))
          .digest('hex')}`,
      });
      signal.throwIfAborted();
      await rename(temporary, resolve(root, `${artifactId}.mp4`));
      return receipt;
    } catch (error) {
      if (signal.aborted) throw signal.reason;
      throw error;
    } finally {
      clearTimeout(timer);
      signal.removeEventListener('abort', closeBrowser);
      if (encoder && encoder.child.exitCode === null) encoder.child.kill('SIGKILL');
      await encoder?.done.catch(() => {});
      await browser?.close().catch(() => {});
      await rm(directory, { recursive: true, force: true });
    }
  }
}
