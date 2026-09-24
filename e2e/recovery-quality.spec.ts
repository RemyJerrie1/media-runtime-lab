import { expect, test } from '@playwright/test';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const asset = {
  id: '00000000-0000-4000-8000-000000000001',
  fileName: 'recovered.mp4',
  mimeType: 'video/mp4',
  sizeBytes: 100,
  url: '/media/recovered.mp4',
};

for (const width of [1280, 390]) {
  test(`malformed media stays readable and keyboard retry is reachable at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    let recovered = false;
    await page.route('**/v1/media/demo', (route) =>
      route.fulfill({ json: recovered ? asset : { id: 42 } }),
    );
    await page.route('**/media/recovered.mp4', (route) => route.fulfill({ status: 204 }));
    await page.goto('/composition');
    // Pin the existing bundled font so Windows runner language packs cannot change glyphs.
    // Pin ancestors too: their fallback-font metrics affect the centered card's subpixel position.
    // Geometry, colors, wrapping and controls still use the production component styles.
    await page.addStyleTag({
      content: `@font-face { font-family: RecoveryEvidence; src: url('/fonts/NotoSansTC.ttf'); }
      :root { --font-sans: RecoveryEvidence, sans-serif; }
      body { font-family: RecoveryEvidence, sans-serif; }`,
    });
    await page.evaluate(() => document.fonts.load('16px RecoveryEvidence'));
    const card = page.getByRole('alert', { name: '示範素材錯誤' });
    await expect(card).toContainText('素材回應格式不正確');
    await expect(card).not.toContainText('invalid_type');
    await card.scrollIntoViewIfNeeded();
    const button = card.getByRole('button', { name: '重試示範素材' });
    const bounds = await button.boundingBox();
    expect(bounds).not.toBeNull();
    expect(
      await button.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
      }),
    ).toBe(true);
    await expect(card).toHaveScreenshot(`media-error-${width}.png`, { animations: 'disabled' });
    await expect(
      page.getByRole('button', { name: '產生 FFmpeg 成品', exact: true }),
    ).toBeDisabled();
    // Begin at a real focusable control; Tab must advance naturally to the retry button.
    await page.getByLabel('浮水印模式').focus();
    await page.keyboard.press('Tab');
    await expect(button).toBeFocused();
    recovered = true;
    await page.keyboard.press('Enter');
    await expect(card).toHaveCount(0);
    await expect(page.getByRole('button', { name: '產生 FFmpeg 成品', exact: true })).toBeEnabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}

for (const failure of ['partial-json', 'offline']) {
  test(`${failure} has a concise recovery message`, async ({ page }) => {
    await page.route('**/v1/media/demo', (route) =>
      failure === 'offline'
        ? route.abort('failed')
        : route.fulfill({ contentType: 'application/json', body: '{"id":' }),
    );
    await page.goto('/composition');
    const card = page.getByRole('alert', { name: '示範素材錯誤' });
    await expect(card).toContainText(failure === 'offline' ? '無法連線取得素材' : '素材回應不完整');
    await expect(card.getByRole('button', { name: '重試示範素材' })).toBeVisible();
  });
}

// Track only API resources owned by the app, excluding Next and browser timers.
async function instrument(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    const resources = { requests: 0, deadlines: new Set<number>() };
    Object.assign(window, { reviewResources: resources });
    const start = window.setTimeout.bind(window);
    const clear = window.clearTimeout.bind(window);
    window.setTimeout = ((handler: TimerHandler, delay?: number, ...args: unknown[]) => {
      const id = start(handler, delay, ...args);
      if (delay === 15_000 || delay === 60_000 || delay === 30_000) resources.deadlines.add(id);
      return id;
    }) as typeof window.setTimeout;
    window.clearTimeout = ((id?: number) => {
      resources.deadlines.delete(id!);
      clear(id);
    }) as typeof window.clearTimeout;
    const fetcher = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      if (!String(input).includes('/v1/media')) return fetcher(input, init);
      resources.requests++;
      try {
        return await fetcher(input, init);
      } finally {
        resources.requests--;
      }
    };
  });
}

test('a superseded source cannot replace the upload even if its transport ignores cancellation', async ({
  page,
}) => {
  await page.addInitScript((oldAsset) => {
    const fetcher = window.fetch.bind(window);
    window.fetch = (input, init) =>
      String(input).endsWith('/v1/media/demo')
        ? new Promise<Response>((resolve) =>
            Object.assign(window, {
              finishOldSource: () => resolve(Response.json({ ...oldAsset, fileName: 'stale.mp4' })),
            }),
          )
        : fetcher(input, init);
  }, asset);
  await page.route('**/v1/media', (route) => route.fulfill({ json: asset }));
  // Held requests intentionally never finish; readiness is asserted below, not via window.load.
  await page.goto('/render', { waitUntil: 'domcontentloaded' });
  await expect
    .poll(() =>
      page.evaluate(
        () => typeof (window as unknown as { finishOldSource?: () => void }).finishOldSource,
      ),
    )
    .toBe('function');
  await page
    .locator('input[type=file]')
    .setInputFiles({ name: 'new.mp4', mimeType: 'video/mp4', buffer: Buffer.from('test') });
  await expect(page.getByRole('heading', { name: 'recovered.mp4', exact: true })).toBeVisible();
  await page.evaluate(() =>
    (window as unknown as { finishOldSource: () => void }).finishOldSource(),
  );
  await expect(page.getByRole('heading', { name: 'recovered.mp4', exact: true })).toBeVisible();
  await expect(page.getByText('stale.mp4', { exact: true })).toHaveCount(0);
});

test('unmounting the actual output player clears its metadata deadline', async ({ page }) => {
  await instrument(page);
  const { build } = createRequire(resolve('packages/scene-renderer/package.json'))('esbuild');
  const result = await build({
    stdin: {
      resolveDir: resolve('apps/web'),
      contents: `import React from 'react'; import {createRoot} from 'react-dom/client';
        import {RecoverableVideo} from './app/shared/ui/recoverable-video';
        const root=createRoot(document.getElementById('root'));
        window.removePlayer=()=>root.unmount();
        root.render(React.createElement(RecoverableVideo, {src:'/held-video.mp4', 'aria-label':'測試影片'}));`,
    },
    bundle: true,
    write: false,
    jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"production"' },
  });
  await page.route('**/__player-harness', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<div id="root"></div>' }),
  );
  await page.route('**/held-video.mp4', () => {});
  await page.goto('/__player-harness');
  await page.addScriptTag({ content: result.outputFiles[0].text });
  await expect.poll(() => resourceCount(page)).toEqual({ requests: 0, deadlines: 1 });
  await page.evaluate(() => (window as unknown as { removePlayer: () => void }).removePlayer());
  await expect.poll(() => resourceCount(page)).toEqual({ requests: 0, deadlines: 0 });
});
async function resourceCount(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const r = (
      window as unknown as { reviewResources: { requests: number; deadlines: Set<number> } }
    ).reviewResources;
    return { requests: r.requests, deadlines: r.deadlines.size };
  });
}
for (const scenario of ['composition', 'render', 'upload', 'retry']) {
  test(`${scenario} unmount cancels requests and clears deadlines`, async ({ page }) => {
    await instrument(page);
    await page.route('**/v1/media/demo', (route) =>
      scenario === 'upload' || scenario === 'retry' ? route.fulfill({ json: asset }) : undefined,
    );
    await page.route('**/v1/media', () => {});
    await page.goto(scenario === 'composition' ? '/composition' : '/render', {
      waitUntil: 'domcontentloaded',
    });
    if (scenario === 'upload' || scenario === 'retry') {
      await expect(page.getByText('0.00 MB · 已就緒', { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: '使用示範影片', exact: true })).toBeEnabled();
      if (scenario === 'upload') {
        await page
          .locator('input[type=file]')
          .setInputFiles({ name: 'test.mp4', mimeType: 'video/mp4', buffer: Buffer.from('test') });
      } else {
        await page.unroute('**/v1/media/demo');
        await page.route('**/v1/media/demo', () => {});
        await page.getByRole('button', { name: '使用示範影片', exact: true }).click();
      }
    }
    await expect.poll(() => resourceCount(page)).toEqual({ requests: 1, deadlines: 1 });
    await page.locator('#tab-overview').click();
    await expect.poll(() => resourceCount(page)).toEqual({ requests: 0, deadlines: 0 });
  });
}
