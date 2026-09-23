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
import { readFile } from 'node:fs/promises';

const storageKey = 'media-runtime-hamster-scene-v1';
const scene = {
  version: 4,
  audio: null,
  caption: defaultHamsterCaption(),
  subject: 'hamster',
  background: '#e8ddd0',
  transform: { x: 0, z: 0, heading: 0, scale: 1 },
  animation: { durationSeconds: 5, end: { x: 0, z: 0, heading: 0 } },
};

async function ready(page: Page) {
  await page.goto('/hamster');
  await expect(page.getByRole('button', { name: '保存場景', exact: true })).toBeEnabled();
  await expect(page.getByLabel('3D 倉鼠場景')).toHaveAttribute('data-ready', 'true', {
    timeout: 30_000,
  });
}
async function slider(page: Page, name: string, value: string) {
  await page.getByRole('slider', { name, exact: true }).fill(value);
}
async function capture(page: Page) {
  return page
    .getByLabel('3D 倉鼠場景')
    .evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL('image/png'));
}

test('real WebGL controls, saved reload and JSON round trip', async ({ page }, testInfo) => {
  await ready(page);
  const initial = await capture(page);
  expect(initial.length).toBeGreaterThan(10_000);
  for (const [name, value] of [
    ['左右位置', '0.8'],
    ['前後位置', '-0.6'],
    ['朝向', '75'],
    ['大小', '1.25'],
  ]) {
    const before = await capture(page);
    await slider(page, name!, value!);
    await expect.poll(() => capture(page)).not.toBe(before);
  }
  await page.getByLabel('背景顏色').fill('#98b7a4');
  await expect(page.getByText('尚未保存', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '保存場景', exact: true }).click();
  const stored = await page.evaluate((key) => localStorage.getItem(key), storageKey);
  expect(JSON.parse(stored!)).toEqual({
    ...scene,
    background: '#98b7a4',
    transform: { x: 0.8, z: -0.6, heading: 75, scale: 1.25 },
  });
  await page.reload();
  await expect(page.getByLabel('3D 倉鼠場景')).toHaveAttribute('data-ready', 'true', {
    timeout: 30_000,
  });
  await expect(page.getByRole('slider', { name: '朝向', exact: true })).toHaveValue('75');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '匯出 JSON' }).click();
  const download = await downloadPromise;
  const downloaded = await readFile((await download.path())!, 'utf8');
  expect(JSON.parse(downloaded)).toEqual(JSON.parse(stored!));
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('button', { name: '重設場景' }).click();
  await expect(page.getByRole('slider', { name: '朝向', exact: true })).toHaveValue('75');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: '重設場景' }).click();
  await expect(page.getByRole('slider', { name: '朝向', exact: true })).toHaveValue('0');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByLabel('匯入 JSON', { exact: true }).setInputFiles({
    name: 'scene.json',
    mimeType: 'application/json',
    buffer: Buffer.from(downloaded),
  });
  await expect(page.getByRole('slider', { name: '朝向', exact: true })).toHaveValue('75');
  await page.screenshot({ path: testInfo.outputPath('hamster-desktop.png'), fullPage: true });
});

test('invalid imports and failed writes preserve current and saved scene', async ({ page }) => {
  await ready(page);
  await page.getByRole('button', { name: '保存場景', exact: true }).click();
  await slider(page, '朝向', '42');
  for (const invalid of [
    '{',
    JSON.stringify({ ...scene, version: 99 }),
    JSON.stringify({ ...scene, transform: { ...scene.transform, x: 300 } }),
    ' '.repeat(16 * 1024 + 1),
  ]) {
    await page.getByLabel('匯入 JSON', { exact: true }).setInputFiles({
      name: 'invalid.json',
      mimeType: 'application/json',
      buffer: Buffer.from(invalid),
    });
    await expect(page.getByRole('tabpanel').getByRole('alert')).toBeVisible();
    await expect(page.getByRole('slider', { name: '朝向', exact: true })).toHaveValue('42');
    expect(
      await page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key)!).transform.heading,
        storageKey,
      ),
    ).toBe(0);
  }
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('button', { name: '保存場景', exact: true }).click();
  expect(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)!).transform.heading,
      storageKey,
    ),
  ).toBe(0);
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException('quota', 'QuotaExceededError');
    };
  });
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: '保存場景', exact: true }).click();
  await expect(page.getByRole('tabpanel').getByRole('alert')).toContainText('保存失敗');
  await expect(page.getByText('尚未保存', { exact: true })).toBeVisible();
});

test('context loss can retry and navigation disposes the old WebGL context', async ({ page }) => {
  await ready(page);
  await page.evaluate(() => {
    const canvas = document.querySelector('canvas')!;
    const context = canvas.getContext('webgl2')!;
    (window as unknown as { oldContext: WebGL2RenderingContext }).oldContext = context;
    context.getExtension('WEBGL_lose_context')!.loseContext();
  });
  await expect(page.getByText(/3D 預覽暫時無法顯示/)).toBeVisible();
  await page.getByRole('button', { name: '重新載入預覽' }).click();
  await expect(page.getByLabel('3D 倉鼠場景')).toHaveAttribute('data-ready', 'true', {
    timeout: 30_000,
  });
  await page.evaluate(() => {
    (window as unknown as { oldContext: WebGL2RenderingContext }).oldContext = document
      .querySelector('canvas')!
      .getContext('webgl2')!;
  });
  await slider(page, '左右位置', '1');
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.getByRole('tab', { name: /影音工作台/ }).click();
  await expect(page).toHaveURL(/\/hamster$/);
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('tab', { name: /影音工作台/ }).click();
  await expect(page).toHaveURL(/\/render$/);
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as unknown as { oldContext: WebGL2RenderingContext }).oldContext.isContextLost(),
      ),
    )
    .toBe(true);
  await expect(page.getByLabel('3D 倉鼠場景')).toHaveCount(0);
  await page.getByRole('tab', { name: /倉鼠小舞台/ }).click();
  await expect(page.getByLabel('3D 倉鼠場景')).toHaveAttribute('data-ready', 'true', {
    timeout: 30_000,
  });
});

test('WebGL and storage unavailable still allow a visible recovery path', async ({ page }) => {
  await page.addInitScript(() => {
    HTMLCanvasElement.prototype.getContext = (() =>
      null) as typeof HTMLCanvasElement.prototype.getContext;
    Storage.prototype.getItem = () => {
      throw new DOMException('denied', 'SecurityError');
    };
  });
  await page.goto('/hamster');
  await expect(page.getByRole('alert', { name: '場景錯誤' })).toContainText('無法讀取本機場景');
  await expect(page.getByRole('button', { name: '重新載入預覽' })).toBeVisible();
  await slider(page, '大小', '0.65');
  await expect(page.getByRole('button', { name: '匯出 JSON' })).toBeEnabled();
});

test('mobile themes and extreme transforms render a capturable stage', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page);
  for (const theme of ['light', 'dark']) {
    if ((await page.locator('html').getAttribute('data-theme')) !== theme) {
      await page.getByRole('button', { name: /切換為.*主題/ }).click();
    }
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
    await page.screenshot({
      path: testInfo.outputPath(`hamster-mobile-${theme}.png`),
      fullPage: true,
    });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      390,
    );
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  for (const x of ['-1.2', '1.2'])
    for (const z of ['-1.2', '1.2']) {
      await slider(page, '左右位置', x);
      await slider(page, '前後位置', z);
      await slider(page, '大小', '1.25');
      await page
        .getByLabel('3D 倉鼠場景')
        .screenshot({ path: testInfo.outputPath(`extreme-${x}-${z}.png`) });
    }
});

test('unsupported saved document remains intact until explicit overwrite; back navigation protects edits', async ({
  page,
}) => {
  const unsupported = JSON.stringify({ ...scene, version: 5 });
  await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), {
    key: storageKey,
    value: unsupported,
  });
  await page.goto('/overview');
  await page.getByRole('button', { name: '打開倉鼠小舞台 →' }).click();
  await expect(page.getByRole('alert', { name: '場景錯誤' })).toContainText('無法讀取本機場景');
  expect(await page.evaluate((key) => localStorage.getItem(key), storageKey)).toBe(unsupported);
  await slider(page, '朝向', '20');
  page.once('dialog', (dialog) => dialog.dismiss());
  await page.goBack();
  await expect(page).toHaveURL(/\/hamster$/);
  await expect(page.getByRole('slider', { name: '朝向', exact: true })).toHaveValue('20');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: '保存場景', exact: true }).click();
  expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), storageKey)).toEqual({
    ...scene,
    transform: { ...scene.transform, heading: 20 },
  });
  await expect(page.getByText('沒有未保存變更', { exact: true })).toBeVisible();
});
