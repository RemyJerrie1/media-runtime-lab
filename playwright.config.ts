import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testIgnore: ['recovery-quality.spec.ts', 'site-visual.spec.ts'],
  fullyParallel: false,
  workers: 1,
  retries: 0,
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'webkit', use: { browserName: 'webkit' } },
  ],
  timeout: 60_000,
  outputDir: '.runtime/playwright-results',
  reporter: [['list'], ['html', { outputFolder: '.runtime/playwright-report', open: 'never' }]],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: [
    {
      command: 'pnpm --filter @media-lab/web exec next start --port 3000',
      url: 'http://localhost:3000/composition',
      reuseExistingServer: false,
      env: { NODE_ENV: 'production' },
    },
    {
      command: 'pnpm --filter @media-lab/api start',
      url: 'http://localhost:4001/v1/operations',
      reuseExistingServer: false,
      env: {
        NODE_ENV: 'development',
        MEDIA_RUNTIME_API_KEY: 'local-demo-key',
        DISABLE_RENDER_WORKER: 'false',
        PORT: '4001',
      },
    },
    {
      command: 'node scripts/e2e-media-proxy.mjs',
      url: 'http://localhost:4000/v1/operations',
      reuseExistingServer: false,
    },
  ],
});
