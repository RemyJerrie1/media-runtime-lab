import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { test, expect } from '@playwright/test';

test('unknown workspace and nested URLs show 404 and return home', async ({ page }) => {
  for (const path of ['/does-not-exist', '/does-not-exist/nested']) {
    const response = await page.goto(path);
    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { name: '找不到指定的媒體頁面。' })).toBeVisible();
    await page.getByRole('link', { name: '返回媒體運行實驗室', exact: true }).click();
    await expect(page).toHaveURL(/\/overview$/);
    await expect(page.getByRole('heading', { name: '影音平台營運後台' })).toBeVisible();
  }
});

test('page effect error reaches the real boundary and reset recovers', async ({ page }) => {
  await page.addInitScript(() => {
    const original = document.getElementById.bind(document);
    let failed = false;
    document.getElementById = (id) => {
      if (!failed && id === 'tab-overview') {
        failed = true;
        throw new Error('controlled page failure');
      }
      return original(id);
    };
  });
  await page.goto('/overview');
  await expect(page.getByRole('heading', { name: '媒體畫面暫時中斷。' })).toBeVisible();
  await expect(page.getByText(/尚未保存的編輯可能遺失/)).toBeVisible();
  await expect(page.getByRole('link', { name: '返回首頁', exact: true })).toHaveAttribute(
    'href',
    '/',
  );
  await page.getByRole('button', { name: '重新載入畫面', exact: true }).click();
  await expect(page.getByRole('heading', { name: '影音平台營運後台' })).toBeVisible();
});

test('root layout failure renders the independent global fallback and resets', async ({ page }) => {
  await page.addInitScript(() => {
    const original = window.matchMedia.bind(window);
    let failed = false;
    window.matchMedia = (query) => {
      if (!failed) {
        failed = true;
        throw new Error('controlled layout failure');
      }
      return original(query);
    };
  });
  await page.goto('/overview');
  await expect(page.getByRole('heading', { name: '應用程式暫時無法顯示。' })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'zh-Hant');
  await page.getByRole('button', { name: '重試畫面', exact: true }).click();
  await expect(page.getByRole('heading', { name: '影音平台營運後台' })).toBeVisible();
});

test('demo failure leaves loading and retry restores the real asset', async ({ page }) => {
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/v1/media/demo', async (route) => {
    await held;
    await route.fulfill({ status: 503, body: 'unavailable' });
  });
  await page.goto('/composition');
  await expect(page.getByText('正在準備電影感示範素材…')).toBeVisible();
  release();
  await expect(page.getByRole('alert', { name: '示範素材錯誤' })).toContainText('503');
  await expect(page.getByText('正在準備電影感示範素材…')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '產生 FFmpeg 成品', exact: true })).toBeDisabled();
  await page.unroute('**/v1/media/demo');
  await page.getByRole('button', { name: '重試示範素材', exact: true }).click();
  await expect(page.getByRole('button', { name: '產生 FFmpeg 成品', exact: true })).toBeEnabled();
  await expect(page.getByRole('alert', { name: '示範素材錯誤' })).toHaveCount(0);
});

// The production routes are statically generated: exercise their actual loading component
// in a delayed React Suspense boundary, without shipping a test-only application route.
test('the actual loading fallback is announced and removed after Suspense resolves', async ({
  page,
}) => {
  const { build } = createRequire(resolve('packages/scene-renderer/package.json'))('esbuild');
  const bundle = await build({
    stdin: {
      resolveDir: resolve('apps/web'),
      contents: `
      import React, { Suspense, lazy } from 'react';
      import { createRoot } from 'react-dom/client';
      import Loading from './app/loading';
      const Content = lazy(() => new Promise(resolve => {
        window.finishLoading = () => resolve({ default: () => React.createElement('h1', null, '內容已就緒') });
      }));
      createRoot(document.getElementById('root')).render(React.createElement(Suspense,
        { fallback: React.createElement(Loading) }, React.createElement(Content)));
    `,
    },
    bundle: true,
    write: false,
    jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"production"' },
  });
  await page.route('**/__loading-harness', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<html lang="zh-Hant"><body><div id="root"></div></body></html>',
    }),
  );
  await page.goto('/__loading-harness');
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  await expect(page.getByRole('status')).toHaveText('正在載入媒體運行系統…');
  await expect(page.getByRole('main')).toHaveAttribute('aria-busy', 'true');
  await page.evaluate(() => (window as unknown as { finishLoading: () => void }).finishLoading());
  await expect(page.getByRole('heading', { name: '內容已就緒' })).toBeVisible();
  await expect(page.getByRole('status')).toHaveCount(0);
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
});
