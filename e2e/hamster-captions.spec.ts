import { test, expect, type Page } from '@playwright/test';

const key = 'media-runtime-hamster-scene-v1';
async function open(page: Page) {
  await page.goto('/hamster');
  await expect(page.getByLabel('3D 倉鼠場景')).toHaveAttribute('data-ready', 'true');
  await expect(page.getByLabel('字幕畫面')).toHaveAttribute('data-ready', 'true');
}
async function seek(page: Page, time: number) {
  await page.getByRole('slider', { name: '預覽時間', exact: true }).fill(String(time));
  await expect(page.getByLabel('目前時間')).toHaveText(`${time.toFixed(2)} / 5.00 秒`);
}
async function pixels(page: Page) {
  return page.getByLabel('字幕畫面').evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL());
}
test('Chinese captions follow exact boundaries, playback, reload and import', async ({
  page,
}, info) => {
  await open(page);
  const blank = await pixels(page);
  await page.getByLabel('顯示字幕', { exact: true }).check();
  await page.getByLabel('字幕文字', { exact: true }).fill('小倉鼠，出發吧！\n五秒鐘的小小冒險');
  await page.getByRole('button', { name: '套用字幕', exact: true }).click();
  await expect(page.getByLabel('字幕畫面')).toHaveAttribute('data-visible', 'true');
  const chinese = await pixels(page);
  expect(chinese).not.toBe(blank);
  expect(
    await page.evaluate(() => document.fonts.check('400 48px "Hamster Noto Sans TC"', '倉鼠')),
  ).toBe(true);
  for (const [time, visible] of [
    [0.99, false],
    [1, true],
    [3.99, true],
    [4, false],
    [1, true],
  ] as const) {
    await seek(page, time);
    await expect(page.getByLabel('字幕畫面')).toHaveAttribute('data-visible', String(visible));
    await expect.poll(() => pixels(page)).toBe(visible ? chinese : blank);
  }
  await page.getByRole('button', { name: '保存場景', exact: true }).click();
  const saved = await page.evaluate((key) => localStorage.getItem(key)!, key);
  expect(JSON.parse(saved).version).toBe(3);
  await page.reload();
  await expect(page.getByLabel('字幕畫面')).toHaveAttribute('data-ready', 'true');
  await expect.poll(() => pixels(page)).toBe(blank);
  await seek(page, 1);
  await expect.poll(() => pixels(page)).toBe(chinese);
  await seek(page, 3.9);
  await page.getByRole('button', { name: '播放', exact: true }).click();
  await expect(page.getByLabel('字幕畫面')).toHaveAttribute('data-visible', 'false');
  await page.getByRole('button', { name: '暫停', exact: true }).click();
  await expect.poll(() => pixels(page)).toBe(blank);
  await seek(page, 5);
  await page.getByRole('button', { name: '重播', exact: true }).click();
  await expect(page.getByLabel('字幕畫面')).toHaveAttribute('data-visible', 'true');
  await page.getByRole('button', { name: '暫停', exact: true }).click();
  await expect.poll(() => pixels(page)).toBe(chinese);
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByLabel('匯入 JSON', { exact: true }).setInputFiles({
    name: 'caption.json',
    mimeType: 'application/json',
    buffer: Buffer.from(saved),
  });
  await expect.poll(() => pixels(page)).toBe(blank);
  await seek(page, 1);
  await expect.poll(() => pixels(page)).toBe(chinese);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByLabel('完整場景畫面').screenshot({ path: info.outputPath('caption-frame.png') });
  await page.screenshot({ path: info.outputPath('caption-desktop.png'), fullPage: true });
});

test('invalid drafts and imports preserve the applied and stored document', async ({ page }) => {
  await open(page);
  await page.getByLabel('顯示字幕', { exact: true }).check();
  await page.getByRole('button', { name: '套用字幕', exact: true }).click();
  await page.getByRole('button', { name: '保存場景', exact: true }).click();
  const saved = await page.evaluate((key) => localStorage.getItem(key)!, key);
  const original = await pixels(page);
  for (const text of ['字'.repeat(41), '一\n二\n三', '🐹']) {
    await page.getByLabel('字幕文字', { exact: true }).fill(text);
    await expect(page.getByRole('tabpanel').getByRole('alert')).toContainText('字幕未套用');
    await expect(page.getByRole('button', { name: '套用字幕', exact: true })).toBeDisabled();
    await expect(page.getByRole('button', { name: '保存場景', exact: true })).toBeDisabled();
    await expect.poll(() => pixels(page)).toBe(original);
  }
  await page.getByRole('button', { name: '捨棄字幕草稿' }).click();
  await page.getByLabel('字幕開始秒數').fill('4');
  await expect(page.getByRole('tabpanel').getByRole('alert')).toContainText('時間');
  await expect(page.getByRole('button', { name: '套用字幕', exact: true })).toBeDisabled();
  expect(await page.evaluate((key) => localStorage.getItem(key), key)).toBe(saved);
  await page.getByRole('button', { name: '捨棄字幕草稿' }).click();
  await page.getByLabel('匯入 JSON', { exact: true }).setInputFiles({
    name: 'invalid.json',
    mimeType: 'application/json',
    buffer: Buffer.from(
      JSON.stringify({ ...JSON.parse(saved), caption: { ...JSON.parse(saved).caption, end: 0 } }),
    ),
  });
  await expect(page.getByRole('tabpanel').getByRole('alert')).toContainText('時間');
  await expect.poll(() => pixels(page)).toBe(original);
});

test('maximum two lines use identical reference pixels on narrow screens and styles persist', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await open(page);
  await page.getByLabel('顯示字幕', { exact: true }).check();
  await page
    .getByLabel('字幕文字', { exact: true })
    .fill('倉鼠出發探索世界今天也是美好的一天啊呀'.slice(0, 20).repeat(2));
  await page.getByLabel('字幕字級', { exact: true }).fill('52');
  await page.getByLabel('字幕文字色', { exact: true }).fill('#ffffaa');
  await page.getByLabel('字幕底色', { exact: true }).fill('#302020');
  await page.getByRole('button', { name: '套用字幕', exact: true }).click();
  const desktop = await pixels(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => pixels(page)).toBe(desktop);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  const frame = await page.getByLabel('完整場景畫面').boundingBox();
  const timeline = await page.getByLabel('預覽時間', { exact: true }).boundingBox();
  expect(frame!.y + frame!.height).toBeLessThan(timeline!.y);
  await page
    .getByLabel('完整場景畫面')
    .screenshot({ path: info.outputPath('caption-mobile-frame.png') });
  await page.screenshot({ path: info.outputPath('caption-mobile.png'), fullPage: true });
  await page.getByRole('button', { name: '保存場景', exact: true }).click();
  await page.reload();
  await expect(page.getByLabel('字幕畫面')).toHaveAttribute('data-ready', 'true');
  await seek(page, 1);
  await expect.poll(() => pixels(page)).toBe(desktop);
});

test('font failure never reports capture ready and retry recovers', async ({ page }) => {
  await page.route('**/fonts/NotoSansTC.ttf', (route) => route.abort());
  await page.goto('/hamster');
  await expect(page.getByText(/字幕字型載入失敗/)).toBeVisible();
  await expect(page.getByLabel('3D 倉鼠場景')).toHaveAttribute('data-ready', 'false');
  await page.unroute('**/fonts/NotoSansTC.ttf');
  await page.getByRole('button', { name: '重新載入預覽' }).click();
  await expect(page.getByLabel('3D 倉鼠場景')).toHaveAttribute('data-ready', 'true');
  await expect(page.getByLabel('字幕畫面')).toHaveAttribute('data-ready', 'true');
});
