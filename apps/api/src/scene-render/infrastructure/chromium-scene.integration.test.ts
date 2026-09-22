import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { mkdir, mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ChromiumSceneProcessor, startSceneProcess } from './chromium-scene.processor';
import { newSceneJob } from '../domain/scene-workflow';
import { sceneCommand } from './scene-fixture';

describe('real scene processor', () => {
  let root: string;
  beforeAll(async () => {
    await mkdir('.runtime', { recursive: true });
    root = await mkdtemp(resolve('.runtime/scene-test-'));
  });
  afterAll(async () => {
    if (root.startsWith(resolve('.runtime') + '/'))
      await rm(root, { recursive: true, force: true });
    else if (root.startsWith(resolve('.runtime') + '\\scene-test-'))
      await rm(root, { recursive: true, force: true });
  });
  it('renders 120 real frames to a validated silent MP4 and cleans temporary frames', async () => {
    const processor = new ChromiumSceneProcessor({ root });
    const frames: number[] = [];
    const receipt = await processor.render(
      newSceneJob(sceneCommand()),
      new AbortController().signal,
      async (count) => {
        frames.push(count);
      },
    );
    expect(receipt.frameCount).toBe(120);
    expect(receipt.durationSeconds).toBeCloseTo(5, 2);
    expect(receipt.audioStreams).toBe(0);
    expect(receipt.sizeBytes).toBeGreaterThan(5000);
    expect(frames.at(-1)).toBe(120);
    expect(frames[0]).toBe(6);
    expect((await readdir(root)).filter((name) => name.startsWith('attempt-'))).toEqual([]);
    await processor.discard(receipt);
    expect(await readdir(root)).toEqual([]);
  }, 120000);
  it('missing font and unavailable WebGL fail explicitly without publishing files', async () => {
    const job = newSceneJob(sceneCommand());
    await expect(
      new ChromiumSceneProcessor({ root, fontPath: resolve(root, 'missing.ttf') }).render(
        job,
        new AbortController().signal,
        async () => {},
      ),
    ).rejects.toThrow('SCENE_FONT_UNAVAILABLE');
    await expect(
      new ChromiumSceneProcessor({ root, chromiumArgs: ['--disable-webgl'] }).render(
        job,
        new AbortController().signal,
        async () => {},
      ),
    ).rejects.toThrow('SCENE_WEBGL_UNAVAILABLE');
    expect(await readdir(root)).toEqual([]);
  }, 30000);
  it('cancellation during frame streaming closes Chromium and FFmpeg and removes partial output', async () => {
    const controller = new AbortController();
    await expect(
      new ChromiumSceneProcessor({ root }).render(
        newSceneJob(sceneCommand()),
        controller.signal,
        async () => {
          controller.abort(new Error('SCENE_CANCELLED'));
        },
      ),
    ).rejects.toThrow('SCENE_CANCELLED');
    expect(await readdir(root)).toEqual([]);
  }, 30000);
  it('a stalled child process is killed when the encoding deadline expires', async () => {
    const controller = new AbortController();
    const process = startSceneProcess(
      globalThis.process.execPath,
      ['-e', 'setInterval(()=>{},1000)'],
      controller.signal,
    );
    const timer = setTimeout(() => controller.abort(new Error('SCENE_RENDER_TIMEOUT')), 100);
    await expect(process.done).rejects.toThrow('SCENE_RENDER_TIMEOUT');
    clearTimeout(timer);
    expect(process.child.signalCode).toBe('SIGKILL');
  });
  it('render deadline cleans its attempt directory and does not return a receipt', async () => {
    await expect(
      new ChromiumSceneProcessor({ root, timeoutMs: 1 }).render(
        newSceneJob(sceneCommand()),
        new AbortController().signal,
        async () => {},
      ),
    ).rejects.toThrow('SCENE_RENDER_TIMEOUT');
    expect(await readdir(root)).toEqual([]);
  }, 30000);
});
