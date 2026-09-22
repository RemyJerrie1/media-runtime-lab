import { test, expect } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
const requireApi = createRequire(resolve('apps/api/package.json'));
const ffmpeg: string = process.env.FFMPEG_BINARY || requireApi('ffmpeg-static');
const ffprobe: string = process.env.FFPROBE_BINARY || requireApi('@ffprobe-installer/ffprobe').path;
const execute = promisify(execFile);
const headers = { 'x-tenant-id': 'portfolio', 'x-api-key': 'local-demo-key' };

test('saved scene exports a real silent MP4 matching preview frames, plays and downloads', async ({
  page,
  request,
}, info) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto('/hamster');
  await expect(page.getByLabel('3D 倉鼠場景')).toHaveAttribute('data-ready', 'true');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: '套用走路示範', exact: true }).click();
  await page.getByLabel('顯示字幕', { exact: true }).check();
  await page.getByLabel('字幕文字', { exact: true }).fill('小倉鼠，出發吧！');
  await page.getByRole('button', { name: '套用字幕', exact: true }).click();
  await page.getByRole('button', { name: '保存場景', exact: true }).click();
  await page.reload();
  await expect(page.getByLabel('3D 倉鼠場景')).toHaveAttribute('data-ready', 'true');
  const references = new Map<number, string>();
  for (const frame of [0, 23, 24, 60, 95, 96]) {
    await page
      .getByLabel('預覽時間', { exact: true })
      .fill(String(Number((frame / 24).toFixed(2))));
    const reference = await page.evaluate(() => {
      const output = document.createElement('canvas');
      output.width = 640;
      output.height = 360;
      const context = output.getContext('2d')!;
      context.drawImage(
        document.querySelector<HTMLCanvasElement>('canvas[aria-label="3D 倉鼠場景"]')!,
        0,
        0,
        640,
        360,
      );
      context.drawImage(
        document.querySelector<HTMLCanvasElement>('canvas[aria-label="字幕畫面"]')!,
        0,
        0,
        640,
        360,
      );
      return output.toDataURL().split(',')[1]!;
    });
    const path = info.outputPath(`preview-${frame}.png`);
    await writeFile(path, Buffer.from(reference, 'base64'));
    references.set(frame, path);
  }
  await page.getByRole('button', { name: '匯出目前場景 MP4', exact: true }).click();
  await expect(page.getByTestId('scene-job-id')).toBeVisible();
  const id = await page.getByTestId('scene-job-id').textContent();
  // Editing now must not change the already submitted immutable snapshot.
  await page.getByLabel('背景顏色', { exact: true }).fill('#123456');
  await expect(page.getByLabel('倉鼠輸出影片')).toBeVisible({ timeout: 90000 });
  const result = await (
    await request.get(`http://localhost:4000/v1/scene-render-jobs/${id}`, { headers })
  ).json();
  expect(result.scene.background).toBe('#e8ddd0');
  expect((await request.get(`http://localhost:4000${result.receipt.artifactUrl}`)).ok()).toBe(true);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('link', { name: '下載倉鼠 MP4' }).click();
  const download = await downloadPromise;
  const movie = info.outputPath('hamster.mp4');
  await download.saveAs(movie);
  const bytes = await readFile(movie);
  expect(result.receipt.checksum).toBe(
    `sha256:${createHash('sha256').update(bytes).digest('hex')}`,
  );
  const probe = JSON.parse(
    (
      await execute(ffprobe, [
        '-v',
        'error',
        '-count_frames',
        '-show_streams',
        '-show_format',
        '-of',
        'json',
        movie,
      ])
    ).stdout,
  );
  expect(probe.streams).toHaveLength(1);
  expect(probe.streams[0]).toMatchObject({
    width: 640,
    height: 360,
    avg_frame_rate: '24/1',
    nb_read_frames: '120',
    codec_name: 'h264',
  });
  expect(Math.abs(Number(probe.format.duration) - 5)).toBeLessThanOrEqual(1 / 24);
  await execute(ffmpeg, ['-v', 'error', '-xerror', '-i', movie, '-f', 'null', '-']);
  const comparisons: Record<string, number> = {};
  for (const [frame, reference] of references) {
    const decoded = info.outputPath(`decoded-${frame}.png`);
    await execute(ffmpeg, [
      '-v',
      'error',
      '-i',
      movie,
      '-vf',
      `select=eq(n\\,${frame})`,
      '-frames:v',
      '1',
      '-y',
      decoded,
    ]);
    const raw = async (path: string) =>
      (
        await execute(
          ffmpeg,
          [
            '-v',
            'error',
            '-i',
            path,
            '-frames:v',
            '1',
            '-f',
            'rawvideo',
            '-pix_fmt',
            'rgb24',
            'pipe:1',
          ],
          { encoding: 'buffer', maxBuffer: 2_000_000 },
        )
      ).stdout;
    const [actual, expected] = await Promise.all([raw(decoded), raw(reference)]);
    expect(actual.length).toBe(640 * 360 * 3);
    let sum = 0,
      caption = 0;
    for (let i = 0; i < actual.length; i++) {
      const delta = Math.abs(actual[i]! - expected[i]!);
      sum += delta;
      if (i >= 640 * 260 * 3) caption += delta;
    }
    comparisons[String(frame)] = sum / actual.length;
    expect(sum / actual.length, `frame ${frame} preview/output MAE`).toBeLessThan(8);
    expect(caption / (640 * 100 * 3), `caption region frame ${frame}`).toBeLessThan(10);
  }
  const video = page.getByLabel('倉鼠輸出影片');
  await video.evaluate((video: HTMLVideoElement) => video.play());
  await expect
    .poll(() => video.evaluate((video: HTMLVideoElement) => video.currentTime))
    .toBeGreaterThan(0.1);
  await video.evaluate((video: HTMLVideoElement) => video.pause());
  await page.screenshot({ path: info.outputPath('export-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: info.outputPath('export-mobile.png'), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await info.attach('receipt', {
    body: JSON.stringify({ result, comparisons, probe }, null, 2),
    contentType: 'application/json',
  });
  await writeFile(
    info.outputPath('receipt.json'),
    JSON.stringify({ result, comparisons, probe }, null, 2),
  );
  page.once('dialog', (dialog) => dialog.accept());
  await page.reload();
  await expect(page.getByTestId('scene-job-id')).toHaveText(id!);
  await expect(page.getByLabel('倉鼠輸出影片')).toBeVisible();
});

test('lost scene response reuses the stored key after reload and conflicting scenes return 409', async ({
  page,
  request,
}) => {
  await page.goto('/hamster');
  let original: { id: string } | undefined;
  let command: Record<string, unknown> | undefined;
  await page.route('http://localhost:4000/v1/scene-render-jobs', async (route) => {
    command = route.request().postDataJSON();
    const response = await route.fetch();
    original = await response.json();
    await route.abort('connectionreset');
    await page.unroute('http://localhost:4000/v1/scene-render-jobs');
  });
  await page.getByRole('button', { name: '匯出目前場景 MP4', exact: true }).click();
  await expect(page.getByRole('button', { name: '重試原輸出操作' })).toBeVisible();
  await page.reload();
  await expect(page.getByTestId('scene-job-id')).toHaveText(original!.id);
  const conflict = await request.post('http://localhost:4000/v1/scene-render-jobs', {
    headers,
    data: { ...command, scene: { ...(command!.scene as object), background: '#000000' } },
  });
  expect(conflict.status()).toBe(409);
  expect((await conflict.json()).code).toBe('IDEMPOTENCY_CONFLICT');
  const cancelled = await request.post(
    `http://localhost:4000/v1/scene-render-jobs/${original!.id}/cancel`,
    { headers, data: {} },
  );
  expect(cancelled.ok()).toBe(true);
  const state = await cancelled.json();
  expect(['cancelled', 'ready']).toContain(state.status);
  if (state.status === 'cancelled') expect(state.receipt).toBeNull();
});
