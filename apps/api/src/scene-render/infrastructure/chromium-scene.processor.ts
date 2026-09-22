import { chromium, type Browser } from 'playwright';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, rename, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import ffmpeg from 'ffmpeg-static';
import ffprobe from '@ffprobe-installer/ffprobe';
import { sceneReceiptSchema, type SceneRenderJob, type SceneReceipt } from '@media-lab/contracts';
import type { SceneProcessor } from '../domain/scene-workflow';

export const sceneArtifactRoot = () => resolve(process.cwd(), '.runtime/scene-artifacts');
type Options = {
  root?: string;
  fontPath?: string;
  timeoutMs?: number;
  chromiumArgs?: string[];
  encoder?: string;
};
type Capture = { init(scene: unknown): Promise<void>; frame(index: number): string };
export function startSceneProcess(binary: string, args: string[], signal: AbortSignal) {
  signal.throwIfAborted();
  const child = spawn(binary, args, { stdio: 'pipe', windowsHide: true });
  let errorText = '';
  const chunks: Buffer[] = [];
  child.stdout.on('data', (chunk: Buffer) => {
    if (chunks.reduce((sum, item) => sum + item.length, 0) < 2_000_000) chunks.push(chunk);
  });
  child.stderr.on('data', (chunk: Buffer) => {
    errorText = (errorText + chunk.toString()).slice(-2000);
  });
  // EPIPE is surfaced by close/write, never as an unhandled EventEmitter error.
  child.stdin.on('error', () => {});
  const abort = () => {
    child.kill('SIGKILL');
  };
  signal.addEventListener('abort', abort, { once: true });
  if (signal.aborted) abort();
  const done = new Promise<Buffer>((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code) => {
      signal.removeEventListener('abort', abort);
      if (signal.aborted) reject(signal.reason);
      else if (code !== 0) reject(new Error(`SCENE_PROCESS_FAILED:${errorText.slice(-300)}`));
      else resolve(Buffer.concat(chunks));
    });
  });
  void done.catch(() => {});
  return { child, done };
}
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
    const temporary = resolve(directory, 'output.mp4');
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
      const font = await readFile(
        this.options.fontPath ?? require.resolve('@media-lab/scene-renderer/font.ttf'),
      ).catch(() => {
        throw new Error('SCENE_FONT_UNAVAILABLE');
      });
      const script = await readFile(
        require.resolve('@media-lab/scene-renderer/capture.js'),
        'utf8',
      );
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
        else if (url === 'http://scene-render.invalid/fonts/NotoSansTC.ttf')
          await route.fulfill({ contentType: 'font/ttf', body: font });
        else await route.abort();
      });
      await page.goto('http://scene-render.invalid/');
      await page.evaluate(
        (scene) => (window as unknown as { sceneCapture: Capture }).sceneCapture.init(scene),
        job.scene,
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
      const probe = startSceneProcess(
        process.env.FFPROBE_BINARY ?? ffprobe.path,
        ['-v', 'error', '-count_frames', '-show_streams', '-show_format', '-of', 'json', temporary],
        signal,
      );
      const metadata = JSON.parse((await probe.done).toString()) as {
        streams: Array<{
          codec_type: string;
          codec_name: string;
          width: number;
          height: number;
          avg_frame_rate: string;
          nb_read_frames: string;
        }>;
        format: { duration: string };
      };
      const stream = metadata.streams[0];
      if (
        metadata.streams.length !== 1 ||
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
        audioStreams: 0,
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
