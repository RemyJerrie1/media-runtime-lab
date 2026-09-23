import { test, expect } from '@playwright/test';

test('leaving while the model loads cannot mark a later workspace ready', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let requested!: () => void;
  const started = new Promise<void>((resolve) => {
    requested = resolve;
  });
  await page.route('**/models/hamster-3.glb', async (route) => {
    requested();
    await held;
    await route.abort().catch(() => {});
  });
  await page.goto('/hamster');
  await started;
  await expect(page.getByLabel('3D 倉鼠場景')).not.toHaveAttribute('data-ready', 'true');
  await page.goto('/composition');
  release();
  await page.unrouteAll({ behavior: 'wait' });
  await page.goto('/hamster');
  await expect(page.getByLabel('3D 倉鼠場景')).toHaveAttribute('data-ready', 'true');
  expect(errors).toEqual([]);
});

test('model loading failure preserves the scene and retry loads the real asset', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/models/hamster-3.glb', (route) =>
    route.fulfill({ status: 503, body: 'unavailable' }),
  );
  await page.goto('/hamster');
  await expect(page.getByRole('button', { name: '重新載入預覽', exact: true })).toBeVisible();
  await expect(page.getByLabel('3D 倉鼠場景')).not.toHaveAttribute('data-ready', 'true');
  await page.unroute('**/models/hamster-3.glb');
  const model = page.waitForResponse((response) =>
    response.url().endsWith('/models/hamster-3.glb'),
  );
  await page.getByRole('button', { name: '重新載入預覽', exact: true }).click();
  expect((await model).status()).toBe(200);
  await expect(page.getByLabel('3D 倉鼠場景')).toHaveAttribute('data-ready', 'true');
  await page.getByLabel('3D 倉鼠場景').screenshot({ path: info.outputPath('accepted-model.png') });
  expect(errors).toEqual([]);
});
