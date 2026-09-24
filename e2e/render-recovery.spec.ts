import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';

const activeKey = 'media-runtime-active-job-v1:composition';
const pendingKey = 'media-runtime-pending-command-v1:composition';
const sourceAssetId = '00000000-0000-4000-8000-000000000001';
const encoding = {
  codec: 'libx264',
  preset: 'fast',
  rateControl: 'crf',
  crf: 23,
  bitrateKbps: 4000,
  gop: 60,
  fps: 30,
};
const processing = {
  frameRateMode: 'cfr',
  audioSampleRate: 48000,
  audioSync: 'async-resample',
  subtitleMode: 'none',
  watermarkMode: 'visible',
  adInsertion: 'none',
  fastStart: true,
  deliveryFormat: 'mp4',
  abrLadder: 'none',
  qualityMetric: 'none',
};
function job(id = 'job-a', sequence = 1, progress = 0, status = 'accepted') {
  return {
    id,
    tenantId: 'portfolio',
    projectId: 'portfolio-reel',
    sourceAssetId,
    status,
    progress,
    stage: status,
    sequence,
    attempt: 1,
    traceId: 'trace',
    requestId: 'request',
    estimatedCostUsd: 0.01,
    tokens: 10,
    template: 'landscape',
    trimStartSeconds: 0,
    durationSeconds: 5,
    encoding,
    processing,
    ffprobeArgs: [],
    ffmpegArgs: [],
    artifactUrl: null,
    artifactChecksum: null,
    manifestUrl: null,
    renditions: [],
    updatedAt: '2026-09-21T00:00:00Z',
  };
}

// Real browser + production React UI, controlled transport for reproducible event ordering.
declare global {
  interface Window {
    testStreams: {
      url: string;
      closed: boolean;
      dispatchEvent: (event: Event) => boolean;
      onerror: (() => void) | null;
    }[];
  }
}
async function setup(page: Page, controlled = true) {
  if (controlled)
    await page.addInitScript(() => {
      window.testStreams = [];
      class ControlledEventSource extends EventTarget {
        closed = false;
        onerror: (() => void) | null = null;
        constructor(public url: string) {
          super();
          window.testStreams.push(this);
        }
        close() {
          this.closed = true;
        }
      }
      Object.defineProperty(window, 'EventSource', { value: ControlledEventSource });
    });
  await page.route('http://localhost:4000/v1/media/demo', (route) =>
    route.fulfill({
      json: {
        id: sourceAssetId,
        fileName: 'demo.mp4',
        mimeType: 'video/mp4',
        sizeBytes: 100,
        url: `/media/${sourceAssetId}`,
      },
    }),
  );
  await page.route('http://localhost:4000/media/**', (route) => route.fulfill({ status: 204 }));
  await page.route('http://localhost:4000/v1/render-jobs', (route) =>
    route.fulfill({ json: job() }),
  );
  await page.goto('/composition');
  await expect(page.getByRole('button', { name: '產生 FFmpeg 成品', exact: true })).toBeEnabled();
}
async function start(page: Page) {
  await page.getByRole('button', { name: '產生 FFmpeg 成品', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.testStreams.length)).toBe(1);
}
async function emit(page: Page, value: unknown, index = 0) {
  await page.evaluate(
    ({ value, index }) => {
      window.testStreams[index].dispatchEvent(
        new MessageEvent('render.progress', { data: JSON.stringify(value) }),
      );
    },
    { value, index },
  );
}
const progress = (page: Page) => page.locator('#composition p[aria-live="polite"]');

test('ignores reordered, duplicate and other-job events without regressing UI', async ({
  page,
}) => {
  await setup(page);
  await start(page);
  await emit(page, job('job-a', 4, 80, 'packaging'));
  await expect(progress(page)).toContainText('80%');
  await emit(page, job('job-a', 2, 20, 'encoding'));
  await emit(page, job('job-a', 4, 10, 'encoding'));
  await emit(page, job('other-job', 99, 0));
  await expect(progress(page)).toContainText('80%');
  await emit(page, job('job-a', 5, 100, 'ready'));
  await emit(page, job('job-a', 6, 0));
  await expect(progress(page)).toContainText('100% · ready');
  await expect.poll(() => page.evaluate(() => window.testStreams[0].closed)).toBe(true);
});

test('reload recovers through GET, reconnect uses recovered sequence, malformed event closes stream', async ({
  page,
}) => {
  await setup(page);
  await start(page);
  await page.route('http://localhost:4000/v1/render-jobs/job-a', (route) =>
    route.fulfill({ json: job('job-a', 3, 60, 'encoding') }),
  );
  await page.reload();
  await expect(progress(page)).toContainText('60%');
  await expect.poll(() => page.evaluate(() => window.testStreams[0]?.url)).toContain('after=3');
  await page.route('http://localhost:4000/v1/render-jobs/job-a', (route) =>
    route.fulfill({ json: job('job-a', 4, 80, 'packaging') }),
  );
  await page.evaluate(() => {
    void window.testStreams[0].onerror?.();
  });
  await expect(progress(page)).toContainText('80%');
  await expect.poll(() => page.evaluate(() => window.testStreams[1]?.url)).toContain('after=4');
  await emit(page, { malformed: true }, 1);
  await expect(page.locator('#composition').getByRole('alert')).toContainText('格式不正確');
  await expect.poll(() => page.evaluate(() => window.testStreams[1].closed)).toBe(true);
  await emit(page, job('job-a', 5, 100, 'ready'), 1);
  await expect(progress(page)).toContainText('80%');
});

test('late recovery cannot overwrite a newly created job or reconnect the old stream', async ({
  page,
}) => {
  await setup(page);
  await start(page);
  let release!: () => void;
  const delayed = new Promise<void>((resolve) => {
    release = resolve;
  });
  let requested = false;
  await page.route('http://localhost:4000/v1/render-jobs/job-a', async (route) => {
    requested = true;
    await delayed;
    await route.fulfill({ json: job('job-a', 10, 90, 'encoding') });
  });
  await page.evaluate(() => {
    void window.testStreams[0].onerror?.();
  });
  await expect.poll(() => requested).toBe(true);
  await page.route('http://localhost:4000/v1/render-jobs', (route) =>
    route.fulfill({ json: job('job-b', 1, 5) }),
  );
  await page.getByRole('button', { name: '產生 FFmpeg 成品', exact: true }).click();
  await expect(progress(page)).toContainText('5%');
  const received = page.waitForResponse('**/v1/render-jobs/job-a');
  release();
  await received;
  await page.clock.install();
  await page.clock.runFor(1500);
  await expect(progress(page)).toContainText('5%');
  expect(await page.evaluate(() => window.testStreams.map((s) => s.url))).toHaveLength(2);
  expect(await page.evaluate(() => window.testStreams[1].url)).toContain('/job-b/');
});

test('storage switch supersedes an older restoration even if its GET finishes last', async ({
  page,
}) => {
  await setup(page);
  let release!: () => void;
  const delayed = new Promise<void>((resolve) => {
    release = resolve;
  });
  let requested = false;
  await page.route('http://localhost:4000/v1/render-jobs/job-a', async (route) => {
    requested = true;
    await delayed;
    await route.fulfill({ json: job('job-a', 8, 90) });
  });
  await page.route('http://localhost:4000/v1/render-jobs/job-b', (route) =>
    route.fulfill({ json: job('job-b', 2, 30) }),
  );
  const switchJob = async (id: string) =>
    page.evaluate(
      ({ key, id }) => {
        localStorage.setItem(key, id);
        window.dispatchEvent(new StorageEvent('storage', { key, newValue: id }));
      },
      { key: activeKey, id },
    );
  await switchJob('job-a');
  await expect.poll(() => requested).toBe(true);
  await switchJob('job-b');
  await expect(progress(page)).toContainText('30%');
  const received = page.waitForResponse('**/v1/render-jobs/job-a');
  release();
  await received;
  await expect(progress(page)).toContainText('30%');
  expect(await page.evaluate(() => window.testStreams.map((s) => s.url))).toHaveLength(1);
});

test('unmount while recovery is pending prevents late reconnection', async ({ page }) => {
  await setup(page);
  await start(page);
  let release!: () => void;
  const delayed = new Promise<void>((resolve) => {
    release = resolve;
  });
  let requested = false;
  await page.route('http://localhost:4000/v1/render-jobs/job-a', async (route) => {
    requested = true;
    await delayed;
    await route.fulfill({ json: job('job-a', 3, 60) });
  });
  await page.evaluate(() => {
    void window.testStreams[0].onerror?.();
  });
  await expect.poll(() => requested).toBe(true);
  // Next client navigation preserves the JS realm, so a leaked timer is observable.
  await page.getByRole('tab', { name: '影音工作台 轉檔、編碼與交付' }).first().click();
  await expect(page).toHaveURL(/\/render$/);
  const received = page.waitForResponse('**/v1/render-jobs/job-a');
  release();
  await received;
  await page.clock.install();
  await page.clock.runFor(1500);
  expect(await page.evaluate(() => window.testStreams.length)).toBe(1);
  expect(await page.evaluate(() => window.testStreams[0].closed)).toBe(true);
});

test('ambiguous submission survives reload, retries identical payload, explicit new intent gets new UUID', async ({
  page,
}) => {
  await setup(page);
  const requests: Record<string, unknown>[] = [];
  const jobs = new Map<string, ReturnType<typeof job>>();
  await page.route('http://localhost:4000/v1/render-jobs', async (route) => {
    const body = route.request().postDataJSON();
    requests.push(body);
    const key = body.idempotencyKey;
    if (!jobs.has(key)) jobs.set(key, job(`job-${jobs.size + 1}`));
    if (requests.length === 1) await route.abort('connectionreset');
    else await route.fulfill({ json: jobs.get(key) });
  });
  await page.getByRole('button', { name: '產生 FFmpeg 成品', exact: true }).click();
  await expect(page.locator('#composition').getByRole('alert')).toContainText('尚未確認');
  expect(await page.evaluate((key) => localStorage.getItem(key), pendingKey)).toBeTruthy();
  await page.reload();
  await expect(page.locator('#composition').getByRole('alert')).toContainText('上次送出');
  await page.getByRole('combobox', { name: '浮水印模式' }).selectOption('dynamic');
  await page.getByRole('button', { name: '重試原操作', exact: true }).click();
  await expect(progress(page)).toContainText('accepted');
  expect(requests[1]).toEqual(requests[0]);
  expect(jobs.size).toBe(1);
  expect(requests[0].idempotencyKey).toMatch(/^[0-9a-f-]{36}$/);
  await page.getByRole('button', { name: '產生 FFmpeg 成品', exact: true }).click();
  await expect.poll(() => requests.length).toBe(3);
  expect(requests[2].idempotencyKey).not.toBe(requests[0].idempotencyKey);
  expect(jobs.size).toBe(2);
});

test('a timed-out submission preserves its payload and key across reload', async ({ page }) => {
  await page.clock.install();
  await setup(page);
  const requests: Record<string, unknown>[] = [];
  await page.route('http://localhost:4000/v1/render-jobs', async (route) => {
    requests.push(route.request().postDataJSON());
    if (requests.length > 1) await route.fulfill({ json: job('same-operation') });
    // Deliberately leave the first response pending until the client deadline aborts it.
  });
  await page.getByRole('button', { name: '產生 FFmpeg 成品', exact: true }).click();
  await expect.poll(() => requests.length).toBe(1);
  await page.clock.fastForward(15001);
  await expect(page.locator('#composition').getByRole('alert')).toContainText('尚未確認');
  const saved = await page.evaluate((key) => localStorage.getItem(key), pendingKey);
  expect(saved).toBeTruthy();
  await page.reload();
  await page.getByRole('button', { name: '重試原操作', exact: true }).click();
  await expect(progress(page)).toContainText('accepted');
  expect(requests).toHaveLength(2);
  expect(requests[1]).toEqual(requests[0]);
  expect(await page.evaluate((key) => localStorage.getItem(key), pendingKey)).toBeNull();
});

test('explicit discard after ambiguous response creates a fresh intent', async ({ page }) => {
  await setup(page);
  const keys: string[] = [];
  await page.route('http://localhost:4000/v1/render-jobs', async (route) => {
    keys.push(route.request().postDataJSON().idempotencyKey);
    if (keys.length === 1) await route.abort('connectionreset');
    else await route.fulfill({ json: job('fresh-job') });
  });
  await page.getByRole('button', { name: '產生 FFmpeg 成品', exact: true }).click();
  await expect(page.locator('#composition').getByRole('alert')).toContainText('尚未確認');
  await page.getByRole('button', { name: '放棄重試，準備新任務' }).click();
  await page.getByRole('button', { name: '產生 FFmpeg 成品', exact: true }).click();
  await expect(progress(page)).toContainText('accepted');
  expect(keys).toHaveLength(2);
  expect(keys[1]).not.toBe(keys[0]);
});

test('synchronous duplicate clicks produce one POST and unmounted creation cannot open a stream', async ({
  page,
}) => {
  await setup(page);
  let release!: () => void;
  const delayed = new Promise<void>((resolve) => {
    release = resolve;
  });
  let posts = 0;
  await page.route('http://localhost:4000/v1/render-jobs', async (route) => {
    posts += 1;
    await delayed;
    await route.fulfill({ json: job() });
  });
  await page
    .getByRole('button', { name: '產生 FFmpeg 成品', exact: true })
    .evaluate((button: HTMLButtonElement) => {
      button.click();
      button.click();
    });
  await expect.poll(() => posts).toBe(1);
  await page.getByRole('tab', { name: '影音工作台 轉檔、編碼與交付' }).click();
  await expect(page).toHaveURL(/\/render$/);
  const received = page.waitForResponse('**/v1/render-jobs');
  release();
  await received;
  await page.clock.install();
  await page.clock.runFor(1500);
  expect(await page.evaluate(() => window.testStreams.length)).toBe(0);
  expect(await page.evaluate((key) => localStorage.getItem(key), pendingKey)).toBeTruthy();
  expect(posts).toBe(1);
});

test('native EventSource disconnect recovers by GET before replaying from the new cursor', async ({
  page,
}) => {
  await setup(page, false);
  const cursors: string[] = [];
  let gets = 0;
  await page.route('http://localhost:4000/v1/render-jobs/job-a', (route) => {
    gets += 1;
    return route.fulfill({ json: job('job-a', 3, 60, 'encoding') });
  });
  await page.route('http://localhost:4000/v1/render-jobs/job-a/events?*', (route) => {
    cursors.push(new URL(route.request().url()).searchParams.get('after')!);
    const next =
      cursors.length === 1 ? job('job-a', 2, 30, 'encoding') : job('job-a', 4, 100, 'ready');
    return route.fulfill({
      contentType: 'text/event-stream',
      headers: { 'access-control-allow-origin': 'http://localhost:3000' },
      body: `event: render.progress\ndata: ${JSON.stringify(next)}\n\n`,
    });
  });
  await page.getByRole('button', { name: '產生 FFmpeg 成品', exact: true }).click();
  await expect(progress(page)).toContainText('100% · ready');
  expect(cursors).toEqual(['1', '3']);
  expect(gets).toBe(1);
});

test('interactive disconnect shows before/after identity and ignores events while paused', async ({
  page,
}, testInfo) => {
  await setup(page);
  await start(page);
  await emit(page, job('job-a', 2, 30, 'encoding'));
  await page.getByRole('button', { name: '中斷進度連線', exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.testStreams[0].closed)).toBe(true);
  await emit(page, job('job-a', 3, 60, 'encoding'));
  await expect(progress(page)).toContainText('30%');
  await page.route('http://localhost:4000/v1/render-jobs/job-a', (route) =>
    route.fulfill({ json: job('job-a', 4, 80, 'packaging') }),
  );
  await page.getByRole('button', { name: '恢復進度連線', exact: true }).click();
  await expect(progress(page)).toContainText('80%');
  await expect(page.getByTestId('recovery-proof')).toContainText('已確認：恢復同一筆任務');
  await expect.poll(() => page.evaluate(() => window.testStreams[1]?.url)).toContain('after=4');
  await page.screenshot({ path: testInfo.outputPath('recovery-proof.png'), fullPage: true });
});

test('benchmark shows persisted measurements and all three actual videos play on mobile', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setup(page);
  const section = page.getByRole('region', { name: '編碼速度、檔案大小與畫面，一起比較' });
  await expect(section).toContainText('已保存的本機測量');
  await expect(section.locator('video')).toHaveCount(3);
  await section.getByRole('button', { name: '三組成品從頭播放' }).click();
  for (const video of await section.locator('video').all()) {
    await expect
      .poll(() => video.evaluate((element: HTMLVideoElement) => element.currentTime))
      .toBeGreaterThan(0);
  }
  await section.locator('summary').click();
  await expect(section).toContainText('SHA-256');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await section.screenshot({ path: testInfo.outputPath('encoding-comparison-mobile.png') });
});

for (const failure of ['missing', 'corrupt', 'timeout'] as const) {
  test(`output video ${failure} can reload without another render command`, async ({ page }) => {
    await page.clock.install();
    await setup(page);
    let commands = 0;
    await page.route('http://localhost:4000/v1/render-jobs', (route) => {
      commands++;
      return route.fulfill({
        json: {
          ...job('completed-video', 2, 100, 'ready'),
          artifactUrl: '/artifacts/recovery.mp4',
          artifactChecksum: 'sha256:checked',
        },
      });
    });
    let recovered = false;
    let reads = 0;
    const movie = await readFile('apps/web/public/media/product-demo.mp4');
    await page.route('**/artifacts/recovery.mp4', (route) => {
      reads++;
      if (recovered) return route.fulfill({ contentType: 'video/mp4', body: movie });
      if (failure === 'timeout') return;
      return route.fulfill({
        status: failure === 'missing' ? 404 : 200,
        contentType: 'video/mp4',
        body: 'broken',
      });
    });
    await page.getByRole('button', { name: '產生 FFmpeg 成品', exact: true }).click();
    await expect.poll(() => reads).toBeGreaterThan(0);
    if (failure === 'timeout') await page.clock.fastForward(30001);
    const error = page.getByRole('alert', { name: '合成輸出影片錯誤' });
    await expect(error).toBeVisible();
    if (failure === 'timeout') await expect(error).toContainText('逾時');
    recovered = true;
    await error.getByRole('button', { name: '重新載入影片' }).click();
    await expect(error).toHaveCount(0);
    const video = page.getByLabel('合成輸出影片', { exact: true });
    await expect
      .poll(() => video.evaluate((el: HTMLVideoElement) => el.readyState))
      .toBeGreaterThanOrEqual(1);
    expect(commands).toBe(1);
    await expect(page.getByTestId('current-job-id')).toHaveText('completed-video');
    await expect(page.getByText('正在載入合成輸出影片…')).toHaveCount(0);
  });
}
