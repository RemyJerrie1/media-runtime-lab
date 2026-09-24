import { defineConfig } from '@playwright/test';

// Mock only the transport: both engines run the production Next/React application.
export default defineConfig({
  testDir: './e2e',
  testMatch: 'recovery-quality.spec.ts',
  workers: 1,
  retries: 0,
  updateSnapshots: 'none',
  timeout: 30_000,
  outputDir: '.runtime/recovery-results',
  snapshotPathTemplate: '{testDir}/recovery-snapshots/{projectName}/{arg}{ext}',
  reporter: [['list'], ['html', { outputFolder: '.runtime/recovery-report', open: 'never' }]],
  use: {
    baseURL: 'http://localhost:3100',
    locale: 'zh-TW',
    colorScheme: 'light',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'webkit', use: { browserName: 'webkit' } },
  ],
  webServer: {
    command: 'pnpm --filter @media-lab/web exec next start --port 3100',
    url: 'http://localhost:3100/overview',
    reuseExistingServer: false,
  },
});
