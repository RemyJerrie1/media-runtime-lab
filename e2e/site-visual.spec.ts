import { expect, test } from '@playwright/test';
import { workspaceSections } from '../apps/web/app/workspace-sections';

for (const width of [390, 1280]) {
  for (const section of workspaceSections) {
    test(`${section} reviewed layout ${width}px @visual`, async ({ page, browserName }) => {
      await page.setViewportSize({ width, height: 900 });
      // A deterministic offline API state makes every recovery entry visible and reproducible.
      await page.route('**/v1/**', (route) => route.abort('failed'));
      await page.goto(`/${section}`, { waitUntil: 'domcontentloaded' });
      await page.evaluate(async () => {
        // Load before applying: CI WebKit left document.fonts.ready pending on the render form.
        const font = await new FontFace('VisualEvidence', "url('/fonts/NotoSansTC.ttf')", {
          weight: '100 900',
        }).load();
        document.fonts.add(font);
      });
      await page.addStyleTag({
        content: `:root { --font-sans: VisualEvidence, sans-serif; --font-mono: VisualEvidence, monospace; }
        body, body * { font-family: VisualEvidence, sans-serif !important; }
        summary { list-style: none; }
        summary::-webkit-details-marker { display: none; }
        summary::before { content: '▶'; display: inline-block; width: 1.1em; }
        details[open] > summary::before { content: '▼'; }
        input::file-selector-button { font: inherit; }
        input::-webkit-file-upload-button { font: inherit; }`,
      });
      if (section === 'hamster')
        await expect(page.getByLabel('3D 倉鼠場景')).toHaveAttribute('data-ready', 'true', {
          timeout: 30_000,
        });
      if (section === 'composition')
        await expect(page.getByRole('alert', { name: '示範素材錯誤' })).toBeVisible();
      if (section === 'render')
        await expect(
          page.getByText('無法連線取得素材，請確認網路與 API 已啟動後重試。'),
        ).toBeVisible();
      await expect(page.getByRole('tabpanel')).toBeVisible();
      expect(
        await page.evaluate(() => ({
          loaded: [...document.fonts].some(
            (font) => font.family === 'VisualEvidence' && font.status === 'loaded',
          ),
          usable: document.fonts.check('16px VisualEvidence', '倉鼠測試 ABC 123'),
        })),
      ).toEqual({ loaded: true, usable: true });
      const previousFontWait = process.env.PW_TEST_SCREENSHOT_NO_FONTS_READY;
      // Windows WebKit can leave fonts.ready pending despite the loaded/usable face above.
      // Replace only that redundant wait; retain pixel comparison and screenshot stability checks.
      if (browserName === 'webkit' && section === 'render')
        process.env.PW_TEST_SCREENSHOT_NO_FONTS_READY = '1';
      try {
        // GPU pixels have separate real WebGL assertions; this baseline owns UI layout and controls.
        await expect(page).toHaveScreenshot(`${section}-${width}.png`, {
          fullPage: true,
          animations: 'disabled',
          mask: [page.locator('canvas'), page.locator('video')],
        });
      } finally {
        if (previousFontWait === undefined) delete process.env.PW_TEST_SCREENSHOT_NO_FONTS_READY;
        else process.env.PW_TEST_SCREENSHOT_NO_FONTS_READY = previousFontWait;
      }
    });
  }
}
