import { expect, test } from '@playwright/test';

// No transport mocks: production web, Nest API, native EventSource and real FFmpeg.
test('real render survives reload and ambiguous POST retry returns the original job', async ({
  page,
  request,
}, testInfo) => {
  test.setTimeout(120_000);
  const headers = { 'x-tenant-id': 'portfolio', 'x-api-key': 'local-demo-key' };
  const health = await request.get('http://localhost:4000/v1/operations', { headers });
  expect(health.ok()).toBeTruthy();
  await page.goto('/composition');
  await page.getByRole('combobox', { name: '浮水印模式' }).selectOption('none');
  let accepted: { id: string } | undefined;
  let payload: Record<string, unknown> | undefined;
  // Let the backend commit the command, then drop only its first response.
  await page.route('http://localhost:4000/v1/render-jobs', async (route) => {
    payload = route.request().postDataJSON();
    const response = await route.fetch();
    expect(response.ok()).toBeTruthy();
    accepted = await response.json();
    await route.abort('connectionreset');
    await page.unroute('http://localhost:4000/v1/render-jobs');
  });
  await page.getByRole('button', { name: '產生 FFmpeg 成品', exact: true }).click();
  await expect(page.locator('#composition').getByRole('alert')).toContainText('尚未確認');
  await page.reload();
  const replay = page.waitForResponse(
    (response) =>
      response.url().endsWith('/v1/render-jobs') && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: '重試原操作', exact: true }).click();
  const replayed = await (await replay).json();
  expect(replayed.id).toBe(accepted!.id);
  const conflict = await request.post('http://localhost:4000/v1/render-jobs', {
    headers,
    data: { ...payload, narration: 'Changed narration under the same key' },
  });
  expect(conflict.status()).toBe(409);
  expect(await conflict.json()).toMatchObject({
    code: 'IDEMPOTENCY_CONFLICT',
    traceId: expect.any(String),
  });
  await page.reload();
  await expect(page.locator('#composition p[aria-live="polite"]')).toContainText('100% · ready', {
    timeout: 90_000,
  });
  const receipt = await request.get(`http://localhost:4000/v1/render-jobs/${accepted!.id}`, {
    headers,
  });
  const completed = await receipt.json();
  expect(completed.artifactChecksum).toBeTruthy();
  expect(completed.tokens).toBeGreaterThan(0);
  expect(completed.estimatedCostUsd).toBeGreaterThanOrEqual(0);
  expect(completed.evidence.playbackVerified).toBe(true);
  const artifact = await request.get(`http://localhost:4000${completed.artifactUrl}`);
  expect(artifact.ok()).toBeTruthy();
  await expect(page.locator('[data-tour="composition-result"] video')).toBeVisible();
  await expect
    .poll(() =>
      page
        .locator('[data-tour="composition-result"] video')
        .evaluate((video: HTMLVideoElement) => video.readyState),
    )
    .toBeGreaterThanOrEqual(2);
  await page.screenshot({ path: testInfo.outputPath('render-ready.png'), fullPage: true });
  await testInfo.attach('receipt', {
    body: JSON.stringify(completed, null, 2),
    contentType: 'application/json',
  });
  expect(
    (
      await request.post('http://localhost:4000/v1/render-jobs', {
        headers,
        data: { ...payload, durationSeconds: -1 },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await request.get(
        'http://localhost:4000/v1/render-jobs/ffffffff-ffff-4fff-8fff-ffffffffffff',
        { headers },
      )
    ).status(),
  ).toBe(404);
  expect(
    (await request.get('http://localhost:4000/v1/render-jobs/malformed', { headers })).status(),
  ).toBe(400);
  expect(
    (
      await request.get(
        'http://localhost:4000/v1/render-jobs/malformed/events?tenantId=portfolio&accessToken=local-demo-key',
      )
    ).status(),
  ).toBe(400);
});

// Bruno covers the repository's HTTP examples against the same live API.
test('Bruno media and render contract checks', async ({}, testInfo) => {
  const { spawnSync } = await import('node:child_process');
  const { resolve } = await import('node:path');
  const result = spawnSync(
    process.execPath,
    [
      resolve('node_modules/@usebruno/cli/bin/bru.js'),
      'run',
      'media-assets/provision-demo.bru',
      'render-jobs',
      '--tests-only',
      '--env',
      'local',
      '--reporter-json',
      testInfo.outputPath('bruno.json'),
    ],
    {
      cwd: resolve('bruno'),
      encoding: 'utf8',
      timeout: 50_000,
    },
  );
  await testInfo.attach('bruno-output', {
    body: `${result.stdout}\n${result.stderr}`,
    contentType: 'text/plain',
  });
  expect(result.error).toBeUndefined();
  expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
});

test('built-in lost-response experiment and replay prove real server deduplication', async ({
  page,
  request,
}, testInfo) => {
  await page.goto('/composition');
  await page.getByRole('combobox', { name: '浮水印模式' }).selectOption('none');
  await page.getByRole('checkbox', { name: '故障注入：下次送出後刻意丟棄成功回應' }).check();
  await page.getByRole('button', { name: '產生 FFmpeg 成品', exact: true }).click();
  await expect(page.locator('#composition').getByRole('alert')).toContainText('故障注入');
  const before = await page.getByTestId('recovery-proof').locator('dd').first().textContent();
  await page.getByRole('button', { name: '重試原操作', exact: true }).click();
  await expect(page.getByTestId('recovery-proof')).toContainText('未建立另一筆任務');
  await expect(page.getByTestId('current-job-id')).toHaveText(before!);
  await page.getByRole('button', { name: '重送原操作（驗證去重）', exact: true }).click();
  await expect(page.getByTestId('recovery-proof')).toContainText('未建立另一筆任務');
  await expect(page.getByTestId('current-job-id')).toHaveText(before!);
  const headers = { 'x-tenant-id': 'portfolio', 'x-api-key': 'local-demo-key' };
  await expect
    .poll(
      async () =>
        (
          await (
            await request.get(`http://localhost:4000/v1/render-jobs/${before}`, { headers })
          ).json()
        ).status,
      { timeout: 90_000 },
    )
    .toBe('ready');
  await page.screenshot({
    path: testInfo.outputPath('real-deduplication-proof.png'),
    fullPage: true,
  });
});
