import { expect, test } from '@playwright/test';
import { workspaceSections } from '../apps/web/app/workspace-sections';

for (const width of [390, 1280]) {
  for (const section of workspaceSections) {
    test(`${section} fits ${width}px @rwd`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/${section}`, { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('tabpanel')).toBeVisible();
      await expect(page.locator(`#tab-${section}`)).toHaveAttribute('aria-selected', 'true');
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
        .toBe(true);
      await expect(page.getByRole('tabpanel').getByRole('heading').first()).toBeVisible();
    });
  }
}

test('keyboard visits every workspace and edits the hamster without a pointer @rwd', async ({
  page,
}) => {
  await page.goto('/overview');
  await page.locator('#tab-overview').focus();
  for (const section of workspaceSections.slice(1)) {
    await page.keyboard.press('ArrowDown');
    await expect(page.locator(`#tab-${section}`)).toBeFocused();
    await expect(page.locator(`#tab-${section}`)).toHaveAttribute('aria-selected', 'true');
  }
  // Focus enters a real control; all subsequent manipulation is keyboard input.
  await page.goto('/hamster');
  await expect(page.getByLabel('3D 倉鼠場景')).toHaveAttribute('data-ready', 'true');
  const scale = page.getByRole('slider', { name: '大小', exact: true });
  await scale.focus();
  const before = await scale.inputValue();
  await page.keyboard.press('ArrowRight');
  await expect(scale).not.toHaveValue(before);
  const save = page.getByRole('button', { name: '保存場景', exact: true });
  await save.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByText('尚未保存', { exact: true })).toHaveCount(0);
});

test('100k caption input and twenty real save clicks remain bounded @abuse', async ({ page }) => {
  await page.goto('/hamster');
  await expect(page.getByLabel('3D 倉鼠場景')).toHaveAttribute('data-ready', 'true');
  await page.getByLabel('顯示字幕', { exact: true }).check();
  await page.getByLabel('字幕文字', { exact: true }).fill('字'.repeat(100_000));
  await expect(page.getByRole('button', { name: '套用字幕', exact: true })).toBeDisabled();
  await expect(page.getByRole('tabpanel').getByRole('alert')).toContainText('字幕未套用');
  await page.getByRole('button', { name: '捨棄字幕草稿' }).click();
  const save = page.getByRole('button', { name: '保存場景', exact: true });
  for (let i = 0; i < 20; i++) await save.click();
  expect(
    await page.evaluate(() => localStorage.getItem('media-runtime-hamster-scene-v1')!.length),
  ).toBeLessThan(16 * 1024);
  await expect(page.getByLabel('3D 倉鼠場景')).toHaveAttribute('data-ready', 'true');
});

test('direct API rejects oversized input, unauthenticated access and a burst @server @abuse', async ({
  request,
}) => {
  const url = 'http://localhost:4000/v1/render-jobs';
  const headers = { 'x-tenant-id': `abuse-${crypto.randomUUID()}`, 'x-api-key': 'local-demo-key' };
  expect((await request.post(url, { data: {} })).status()).toBe(401);
  expect(
    (await request.post(url, { headers, data: { narration: '字'.repeat(100_000) } })).status(),
  ).toBe(413);
  const statuses = [];
  for (let i = 0; i < 40; i++)
    statuses.push((await request.post(url, { headers, data: {} })).status());
  expect(statuses).toContain(400);
  expect(statuses).toContain(429);
  expect(statuses.every((code) => code === 400 || code === 429)).toBe(true);
  expect((await request.get('http://localhost:4000/v1/operations', { headers })).ok()).toBe(true);
});

test('twenty real API submissions of one intent create one job @server @abuse', async ({
  request,
}) => {
  const headers = { 'x-tenant-id': `dedupe-${crypto.randomUUID()}`, 'x-api-key': 'local-demo-key' };
  const source = await (
    await request.post('http://localhost:4000/v1/media/demo', { headers })
  ).json();
  const command = {
    projectId: 'burst-test',
    sourceAssetId: source.id,
    template: 'landscape',
    trimStartSeconds: 0,
    durationSeconds: 1,
    encoding: {
      codec: 'libx264',
      preset: 'ultrafast',
      rateControl: 'crf',
      crf: 23,
      bitrateKbps: 600,
      gop: 24,
      fps: 24,
    },
    processing: {
      frameRateMode: 'cfr',
      audioSampleRate: 48000,
      audioSync: 'async-resample',
      subtitleMode: 'none',
      watermarkMode: 'none',
      adInsertion: 'none',
      fastStart: true,
      deliveryFormat: 'mp4',
      abrLadder: 'none',
      qualityMetric: 'none',
    },
    narration: 'real repeated submission',
    idempotencyKey: crypto.randomUUID(),
  };
  const responses = await Promise.all(
    Array.from({ length: 20 }, () =>
      request.post('http://localhost:4000/v1/render-jobs', { headers, data: command }),
    ),
  );
  expect(responses.every((response) => response.ok())).toBe(true);
  const ids = await Promise.all(responses.map(async (response) => (await response.json()).id));
  expect(new Set(ids).size).toBe(1);
  const job = await request.get(`http://localhost:4000/v1/render-jobs/${ids[0]}`, { headers });
  expect((await job.json()).id).toBe(ids[0]);
});
