import { test, expect, type Page } from '@playwright/test';

const defaultHamsterCaption = () => ({
  enabled: false,
  text: '小倉鼠，出發吧！',
  start: 1,
  end: 4,
  fontSize: 48,
  color: '#ffffff',
  background: '#252525',
});

const key = 'media-runtime-hamster-scene-v1';
async function open(page: Page) {
  await page.goto('/hamster');
  await expect(page.getByLabel('3D 倉鼠場景')).toHaveAttribute('data-ready', 'true');
}
async function seek(page: Page, seconds: number) {
  await page.getByRole('slider', { name: '預覽時間', exact: true }).fill(String(seconds));
  await expect(page.getByLabel('目前時間')).toHaveText(`${seconds.toFixed(2)} / 5.00 秒`);
}
async function image(page: Page) {
  return page.getByLabel('3D 倉鼠場景').evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL());
}
async function demo(page: Page) {
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: '套用走路示範', exact: true }).click();
}

test('absolute-time WebGL frames survive reverse seeking, save and reload', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await open(page);
  await demo(page);
  const frames = new Map<number, string>();
  for (const t of [0, 1, 2.5, 4, 5]) {
    await seek(page, t);
    await page.getByLabel('3D 倉鼠場景').screenshot({ path: testInfo.outputPath(`pose-${t}.png`) });
    frames.set(t, await image(page));
  }
  expect(new Set(frames.values()).size).toBe(5);
  for (const t of [4, 1, 5, 0, 2.5]) {
    await seek(page, t);
    await expect.poll(() => image(page)).toBe(frames.get(t));
  }
  await page.getByRole('button', { name: '保存場景', exact: true }).click();
  await page.reload();
  await expect(page.getByLabel('3D 倉鼠場景')).toHaveAttribute('data-ready', 'true');
  await seek(page, 2.5);
  await expect.poll(() => image(page)).toBe(frames.get(2.5));
  await expect(page.getByText('沒有未保存變更', { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('animation-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('combobox', { name: '正在編輯' }).selectOption('end');
  await expect(page.getByRole('slider', { name: '左右位置', exact: true })).toHaveValue('0.6');
  await page.getByRole('slider', { name: '左右位置', exact: true }).fill('1');
  await expect(page.getByLabel('目前時間')).toContainText('5.00 / 5.00');
  await page.getByRole('combobox', { name: '正在編輯' }).selectOption('start');
  await expect(page.getByRole('slider', { name: '左右位置', exact: true })).toHaveValue('-1.2');
  await seek(page, 2.5);
  await page.screenshot({ path: testInfo.outputPath('animation-mobile.png'), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('legacy storage and JSON migrate to static v4 only on explicit save', async ({ page }) => {
  const legacy = {
    version: 1,
    subject: 'hamster',
    background: '#abcdef',
    transform: { x: 0.7, z: -0.4, heading: 50, scale: 0.8 },
  };
  await page.addInitScript(({ key, legacy }) => localStorage.setItem(key, JSON.stringify(legacy)), {
    key,
    legacy,
  });
  await open(page);
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).version, key)).toBe(1);
  const still = await image(page);
  await seek(page, 2.5);
  await expect.poll(() => image(page)).toBe(still);
  await seek(page, 5);
  await expect.poll(() => image(page)).toBe(still);
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: '保存場景', exact: true }).click();
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), key)).toEqual({
    ...legacy,
    version: 4,
    audio: null,
    caption: defaultHamsterCaption(),
    animation: { durationSeconds: 5, end: { x: 0.7, z: -0.4, heading: 50 } },
  });
  await demo(page);
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByLabel('匯入 JSON', { exact: true }).setInputFiles({
    name: 'v1.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(legacy)),
  });
  await seek(page, 4);
  await expect.poll(() => image(page)).toBe(still);
});

test('play, pause, resume, endpoint stop and replay use elapsed time; hidden tabs pause', async ({
  page,
}) => {
  await open(page);
  await demo(page);
  await page.getByRole('button', { name: '保存場景', exact: true }).click();
  await page.getByRole('button', { name: '播放', exact: true }).click();
  await expect
    .poll(async () =>
      Number(await page.getByRole('slider', { name: '預覽時間', exact: true }).inputValue()),
    )
    .toBeGreaterThan(0.2);
  await page.getByRole('button', { name: '暫停', exact: true }).click();
  const paused = await page.getByRole('slider', { name: '預覽時間', exact: true }).inputValue();
  const pausedFrame = await image(page);
  await expect(page.getByRole('button', { name: '播放', exact: true })).toBeVisible();
  await expect(page.getByText('沒有未保存變更', { exact: true })).toBeVisible();
  await expect.poll(() => image(page)).toBe(pausedFrame);
  await page.getByRole('button', { name: '播放', exact: true }).click();
  await expect
    .poll(async () =>
      Number(await page.getByRole('slider', { name: '預覽時間', exact: true }).inputValue()),
    )
    .toBeGreaterThan(Number(paused));
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.getByText('切換分頁時已暫停，按播放即可繼續。')).toBeVisible();
  const hiddenTime = await page.getByRole('slider', { name: '預覽時間', exact: true }).inputValue();
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.getByRole('slider', { name: '預覽時間', exact: true })).toHaveValue(hiddenTime);
  await seek(page, 4.8);
  await page.getByRole('button', { name: '播放', exact: true }).click();
  await expect(page.getByRole('button', { name: '重播', exact: true })).toBeVisible();
  await expect(page.getByLabel('目前時間')).toHaveText('5.00 / 5.00 秒');
  await page.getByRole('button', { name: '重播', exact: true }).click();
  await expect(page.getByRole('button', { name: '暫停', exact: true })).toBeVisible();
  await expect
    .poll(async () =>
      Number(await page.getByRole('slider', { name: '預覽時間', exact: true }).inputValue()),
    )
    .toBeLessThan(1);
  await page.getByRole('button', { name: '回到開頭', exact: true }).click();
  await expect(page.getByLabel('目前時間')).toHaveText('0.00 / 5.00 秒');
});

test('unmount cancels animation callbacks and a new workspace starts paused', async ({ page }) => {
  await page.addInitScript(() => {
    const request = window.requestAnimationFrame.bind(window),
      cancel = window.cancelAnimationFrame.bind(window);
    const pending = new Set<number>();
    (window as unknown as { pendingFrames: Set<number> }).pendingFrames = pending;
    window.requestAnimationFrame = (callback) => {
      const id = request((time) => {
        pending.delete(id);
        callback(time);
      });
      pending.add(id);
      return id;
    };
    window.cancelAnimationFrame = (id) => {
      pending.delete(id);
      cancel(id);
    };
  });
  await open(page);
  await page.getByRole('button', { name: '播放', exact: true }).click();
  await expect(page.getByRole('button', { name: '暫停', exact: true })).toBeVisible();
  await page.getByRole('tab', { name: /平台概覽/ }).click();
  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as { pendingFrames: Set<number> }).pendingFrames.size),
    )
    .toBe(0);
  await page.getByRole('tab', { name: /倉鼠小舞台/ }).click();
  await expect(page.getByLabel('目前時間')).toHaveText('0.00 / 5.00 秒');
  await expect(page.getByRole('button', { name: '播放', exact: true })).toBeVisible();
});
