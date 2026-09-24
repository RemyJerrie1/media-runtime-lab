import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { cpus, platform } from 'node:os';

// Interactive portfolio budgets, with room for slower shared CI CPUs.
const BUDGET = { loadMs: 3000, interactionMs: 1000, retainedBytes: 4 * 1024 * 1024 };
const LOAD_SAMPLES = 5;
const WARMUP_CYCLES = 5;
const MEASURED_CYCLES = 100;

const requireWeb = createRequire(resolve('apps/web/package.json'));
const origin = 'http://localhost:3111';
const server = spawn(
  process.execPath,
  [requireWeb.resolve('next/dist/bin/next'), 'start', '--port', '3111'],
  {
    cwd: resolve('apps/web'),
    stdio: 'ignore',
    env: { ...process.env, NODE_ENV: 'production' },
  },
);
let browser;
try {
  const deadline = Date.now() + 30_000;
  while (
    !(await fetch(`${origin}/overview`, { signal: AbortSignal.timeout(1000) })
      .then((r) => r.ok)
      .catch(() => false))
  ) {
    if (Date.now() > deadline || server.exitCode !== null)
      throw new Error('Benchmark server failed');
    await new Promise((r) => setTimeout(r, 200));
  }
  browser = await chromium.launch();
  const page = await browser.newPage();
  await page.route('**/v1/media/demo', (route) =>
    route.fulfill({
      json: {
        id: '00000000-0000-4000-8000-000000000001',
        fileName: 'benchmark.mp4',
        mimeType: 'video/mp4',
        sizeBytes: 100,
        url: '/media/benchmark.mp4',
      },
    }),
  );
  const cdp = await page.context().newCDPSession(page);
  const heap = async () => {
    await cdp.send('HeapProfiler.collectGarbage');
    return (await cdp.send('Runtime.getHeapUsage')).usedSize;
  };
  const loads = [],
    interactions = [];
  for (let i = 0; i <= LOAD_SAMPLES; i++) {
    const start = performance.now();
    await page.goto(`${origin}/render`, { waitUntil: 'domcontentloaded' });
    await page
      .getByText('0.00 MB · 已就緒', { exact: true })
      .waitFor()
      .catch(async (error) => {
        console.error(await page.locator('body').innerText());
        throw error;
      });
    if (i) loads.push(performance.now() - start);
  }
  const cycle = async () => {
    await page.locator('#tab-overview').click();
    const start = performance.now();
    await page.locator('#tab-render').click();
    await page.getByText('0.00 MB · 已就緒', { exact: true }).waitFor();
    return performance.now() - start;
  };
  for (let i = 0; i < WARMUP_CYCLES; i++) await cycle();
  const heapBefore = await heap();
  for (let i = 0; i < MEASURED_CYCLES; i++) interactions.push(await cycle());
  const heapAfter = await heap();
  const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
  const result = {
    environment: {
      node: process.version,
      os: platform(),
      cpu: cpus()[0].model,
      browser: browser.version(),
    },
    loadMedianMs: Math.round(median(loads)),
    interactionMedianMs: Math.round(median(interactions)),
    heapBefore,
    heapAfter,
    retainedBytes: heapAfter - heapBefore,
    cycles: MEASURED_CYCLES,
    budget: BUDGET,
    loads,
    interactions,
  };
  const outputIndex = process.argv.indexOf('--output');
  const output = outputIndex >= 0 ? process.argv[outputIndex + 1] : '.runtime/web-benchmark.json';
  await mkdir(resolve('.runtime'), { recursive: true });
  await writeFile(output, JSON.stringify(result, null, 2));
  console.log(JSON.stringify({ ...result, loads: undefined, interactions: undefined }, null, 2));
  // Local portfolio responsiveness budgets; allow CI hardware variance, but bound sustained growth.
  if (
    process.argv.includes('--verify') &&
    (result.loadMedianMs > BUDGET.loadMs ||
      result.interactionMedianMs > BUDGET.interactionMs ||
      result.retainedBytes > BUDGET.retainedBytes)
  )
    throw new Error('Web performance budget exceeded');
} finally {
  await browser?.close();
  server.kill();
}
