import { test, expect } from '@playwright/test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { writeFile } from 'node:fs/promises';
const requireApi = createRequire(resolve('apps/api/package.json'));
const ffmpeg: string = process.env.FFMPEG_BINARY || requireApi('ffmpeg-static');
const ffprobe: string = process.env.FFPROBE_BINARY || requireApi('@ffprobe-installer/ffprobe').path;
const execute = promisify(execFile);
const headers = { 'x-tenant-id': 'portfolio', 'x-api-key': 'local-demo-key' };

test('denied browser audio pauses the timeline and user retry recovers without duplicate players', async ({
  page,
}, info) => {
  const source = info.outputPath('permission.wav');
  await execute(ffmpeg, [
    '-v',
    'error',
    '-f',
    'lavfi',
    '-i',
    'sine=duration=3',
    '-c:a',
    'pcm_s16le',
    source,
  ]);
  await page.addInitScript(() => {
    const original = HTMLMediaElement.prototype.play;
    let denied = false;
    HTMLMediaElement.prototype.play = function () {
      if (this instanceof HTMLAudioElement && !denied) {
        denied = true;
        return Promise.reject(new DOMException('test playback permission', 'NotAllowedError'));
      }
      return original.call(this);
    };
  });
  await page.goto('/hamster');
  await page.getByLabel('上傳音檔', { exact: true }).setInputFiles(source);
  await expect(page.getByText('音訊已就緒', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: '播放', exact: true }).click();
  await expect(page.getByRole('alert', { name: '音訊錯誤' })).toContainText('瀏覽器未能播放音訊');
  await expect(page.getByRole('button', { name: '播放', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '播放', exact: true }).click();
  const audio = page.getByLabel('場景音訊預覽', { exact: true });
  await expect(audio).toHaveCount(1);
  await expect.poll(() => audio.evaluate((el: HTMLAudioElement) => el.paused)).toBe(false);
  await expect
    .poll(() => audio.evaluate((el: HTMLAudioElement) => el.currentTime))
    .toBeGreaterThan(0.1);
  await expect(page.getByRole('alert', { name: '音訊錯誤' })).toHaveCount(0);
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('tab', { name: /平台概覽/ }).click();
  await expect(audio).toHaveCount(0);
});

test('audio upload, persisted timeline, playback controls and real audible/muted exports', async ({
  page,
  request,
}, info) => {
  // Two exports each retain the production 120-second deadline, plus UI/decode time.
  test.setTimeout(300000);
  const source = info.outputPath('tone.wav');
  await execute(ffmpeg, [
    '-v',
    'error',
    '-f',
    'lavfi',
    '-i',
    'sine=frequency=440:sample_rate=48000:duration=3',
    '-c:a',
    'pcm_s16le',
    source,
  ]);
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto('/hamster');
  await page.getByLabel('上傳音檔', { exact: true }).setInputFiles(source);
  await expect(page.getByText('音訊已就緒', { exact: false })).toBeVisible();
  const id = await page.getByTestId('scene-audio-id').textContent();
  await page.getByLabel('音檔起點', { exact: true }).fill('0.5');
  await page.getByLabel('配音開始時間', { exact: true }).fill('1');
  await page.getByLabel('音訊音量', { exact: true }).fill('0.5');
  await page.getByRole('button', { name: '保存場景', exact: true }).click();
  await page.reload();
  await expect(page.getByTestId('scene-audio-id')).toHaveText(id!);
  await expect(page.getByText('音訊已就緒', { exact: false })).toBeVisible();
  const audio = page.getByLabel('場景音訊預覽', { exact: true });
  await expect.poll(() => audio.evaluate((el: HTMLAudioElement) => el.paused)).toBe(true);
  await page.getByLabel('預覽時間', { exact: true }).fill('2');
  await expect
    .poll(() => audio.evaluate((el: HTMLAudioElement) => el.currentTime))
    .toBeCloseTo(1.5, 1);
  await page.getByRole('button', { name: '播放', exact: true }).click();
  await expect.poll(() => audio.evaluate((el: HTMLAudioElement) => el.paused)).toBe(false);
  await expect
    .poll(() => audio.evaluate((el: HTMLAudioElement) => el.currentTime))
    .toBeGreaterThan(1.6);
  expect(await audio.evaluate((el: HTMLAudioElement) => el.volume)).toBe(0.5);
  await page.getByRole('button', { name: '暫停', exact: true }).click();
  await expect.poll(() => audio.evaluate((el: HTMLAudioElement) => el.paused)).toBe(true);
  await page.getByLabel('預覽時間', { exact: true }).fill('5');
  await page.getByRole('button', { name: '重播', exact: true }).click();
  await expect.poll(() => audio.evaluate((el: HTMLAudioElement) => el.paused)).toBe(false);
  await page.getByRole('button', { name: '暫停', exact: true }).click();
  await page.getByLabel('靜音音軌', { exact: true }).check();
  await page.getByLabel('預覽時間', { exact: true }).fill('2');
  await page.getByRole('button', { name: '播放', exact: true }).click();
  await expect
    .poll(() => audio.evaluate((el: HTMLAudioElement) => el.muted && el.paused))
    .toBe(true);
  await page.getByRole('button', { name: '暫停', exact: true }).click();
  await page.getByLabel('靜音音軌', { exact: true }).uncheck();
  await page.getByRole('button', { name: '匯出目前場景 MP4', exact: true }).click();
  await expect(page.getByLabel('倉鼠輸出影片')).toBeVisible({ timeout: 130000 });
  const jobId = await page.getByTestId('scene-job-id').textContent();
  const job = await (
    await request.get(`http://localhost:4000/v1/scene-render-jobs/${jobId}`, { headers })
  ).json();
  expect(job.receipt.audioStreams).toBe(1);
  expect(job.scene.audio.asset.id).toBe(id);
  const command = {
    version: 1,
    kind: 'hamster-scene',
    scene: job.scene,
    idempotencyKey: crypto.randomUUID(),
  };
  // Metadata identity cannot be forged even when the opaque ID exists.
  const invalid = await request.post('http://localhost:4000/v1/scene-render-jobs', {
    headers,
    data: {
      ...command,
      scene: {
        ...job.scene,
        audio: {
          ...job.scene.audio,
          asset: { ...job.scene.audio.asset, checksum: `sha256:${'0'.repeat(64)}` },
        },
      },
    },
  });
  expect(invalid.status()).toBe(400);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('link', { name: '下載倉鼠 MP4' }).click();
  const movie = info.outputPath('hamster-audio.mp4');
  await (await downloadPromise).saveAs(movie);
  const probe = JSON.parse(
    (await execute(ffprobe, ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', movie]))
      .stdout,
  );
  expect(
    probe.streams.find((stream: { codec_type: string }) => stream.codec_type === 'audio'),
  ).toMatchObject({ codec_name: 'aac', sample_rate: '48000', channels: 2 });
  expect(Math.abs(Number(probe.format.duration) - 5)).toBeLessThan(1 / 24);
  await execute(ffmpeg, ['-v', 'error', '-xerror', '-i', movie, '-f', 'null', '-']);
  const pcm = (
    await execute(
      ffmpeg,
      ['-v', 'error', '-i', movie, '-vn', '-ac', '1', '-ar', '48000', '-f', 'f32le', 'pipe:1'],
      { encoding: 'buffer', maxBuffer: 2_000_000 },
    )
  ).stdout;
  const rms = (start: number, end: number) => {
    let sum = 0;
    for (let i = start * 48000; i < end * 48000; i++) sum += pcm.readFloatLE(i * 4) ** 2;
    return Math.sqrt(sum / ((end - start) * 48000));
  };
  let onset = 0;
  for (let i = 0; i < pcm.length / 4; i++)
    if (Math.abs(pcm.readFloatLE(i * 4)) > 0.002) {
      onset = i / 48000;
      break;
    }
  expect(Math.abs(onset - 1)).toBeLessThan(1 / 24);
  expect(rms(0, 0.9)).toBeLessThan(0.001);
  expect(rms(1.2, 2.2)).toBeGreaterThan(0.03);
  expect(rms(3.7, 4.9)).toBeLessThan(0.001);
  const video = page.getByLabel('倉鼠輸出影片');
  await video.evaluate((el: HTMLVideoElement) => el.play());
  await expect
    .poll(() => video.evaluate((el: HTMLVideoElement) => el.currentTime))
    .toBeGreaterThan(0.2);
  await video.evaluate((el: HTMLVideoElement) => el.pause());
  probe.format.filename = 'hamster-audio.mp4';
  await writeFile(
    info.outputPath('audio-receipt.json'),
    JSON.stringify(
      {
        job,
        probe,
        onsetSeconds: onset,
        rms: { before: rms(0, 0.9), active: rms(1.2, 2.2), tail: rms(3.7, 4.9) },
      },
      null,
      2,
    ),
  );
  await page.screenshot({ path: info.outputPath('audio-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: info.outputPath('audio-mobile.png'), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.getByLabel('靜音音軌', { exact: true }).check();
  await page.getByRole('button', { name: '匯出目前場景 MP4', exact: true }).click();
  await expect(page.getByTestId('scene-job-id')).not.toHaveText(jobId!);
  await expect(page.getByLabel('倉鼠輸出影片')).toBeVisible({ timeout: 130000 });
  const mutedId = await page.getByTestId('scene-job-id').textContent();
  const muted = await (
    await request.get(`http://localhost:4000/v1/scene-render-jobs/${mutedId}`, { headers })
  ).json();
  expect(muted.receipt.audioStreams).toBe(0);
  await page.getByRole('button', { name: '移除音軌', exact: true }).click();
  await expect(audio).toHaveCount(0);
});

test('invalid and missing audio preserve the scene, permit replacement and keep silent export available', async ({
  page,
  request,
}, info) => {
  await page.goto('/hamster');
  await page.getByLabel('背景顏色', { exact: true }).fill('#abcdef');
  await page
    .getByLabel('上傳音檔', { exact: true })
    .setInputFiles({ name: 'broken.wav', mimeType: 'audio/wav', buffer: Buffer.from('invalid') });
  await expect(page.getByRole('alert', { name: '音訊錯誤' })).toContainText('音檔無法使用');
  await expect(page.getByLabel('背景顏色', { exact: true })).toHaveValue('#abcdef');
  const source = info.outputPath('replacement.mp3');
  await execute(ffmpeg, [
    '-v',
    'error',
    '-f',
    'lavfi',
    '-i',
    'sine=duration=2',
    '-c:a',
    'libmp3lame',
    source,
  ]);
  const scene = await page.evaluate(() => ({
    version: 4,
    subject: 'hamster',
    background: '#abcdef',
    transform: { x: 0, z: 0, heading: 0, scale: 1 },
    animation: { durationSeconds: 5, end: { x: 0, z: 0, heading: 0 } },
    caption: {
      enabled: false,
      text: 'Hello',
      start: 1,
      end: 4,
      fontSize: 48,
      color: '#ffffff',
      background: '#252525',
    },
    audio: {
      asset: {
        id: '11111111-1111-4111-8111-111111111111',
        url: '/scene-audio/11111111-1111-4111-8111-111111111111.wav',
        checksum: 'sha256:' + 'a'.repeat(64),
        durationSeconds: 2,
        sizeBytes: 5000,
      },
      trimStart: 0,
      start: 0,
      volume: 0.7,
      muted: false,
    },
  }));
  await page.evaluate(
    (scene) => localStorage.setItem('media-runtime-hamster-scene-v1', JSON.stringify(scene)),
    scene,
  );
  page.once('dialog', (dialog) => dialog.accept());
  await page.reload();
  await expect(page.getByRole('alert', { name: '音訊錯誤' })).toBeVisible();
  await expect(page.getByLabel('背景顏色', { exact: true })).toHaveValue('#abcdef');
  await page.getByLabel('上傳音檔', { exact: true }).setInputFiles(source);
  await expect(page.getByText('音訊已就緒', { exact: false })).toBeVisible();
  await expect(page.getByRole('alert', { name: '音訊錯誤' })).toHaveCount(0);
  const id = await page.getByTestId('scene-audio-id').textContent();
  const range = await request.get(`http://localhost:4000/scene-audio/${id}.wav`, {
    headers: { range: 'bytes=0-99' },
  });
  expect(range.status()).toBe(206);
  expect((await range.body()).length).toBe(100);
  await page.getByRole('button', { name: '移除音軌', exact: true }).click();
  await expect(page.getByRole('button', { name: '匯出目前場景 MP4', exact: true })).toBeEnabled();
});
