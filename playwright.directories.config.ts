import { defineConfig } from '@playwright/test';

const port = process.env.DIRECTORIES_TEST_PORT ?? '5188';
const sourceRoot = process.env.DIRECTORIES_SOURCE_ROOT;
const development = process.env.DIRECTORIES_DEV === '1';

export default defineConfig({
  testDir: './tests/directories-ui',
  outputDir: process.env.DIRECTORIES_OUTPUT ?? './test-results/directories-ui',
  fullyParallel: true,
  workers: 2,
  timeout: 45_000,
  expect: { timeout: 12_000 },
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${port}`,
    viewport: { width: 1440, height: 1000 },
    screenshot: 'only-on-failure',
    trace: process.env.DIRECTORIES_TRACE === '1' ? 'on' : 'retain-on-failure',
    video: process.env.DIRECTORIES_VIDEO === '1' ? 'on' : 'off',
  },
  // Build first: these checks exercise the deployed bundle structure.
  webServer: {
    command: `npm run ${development ? 'dev' : 'preview'} -- --port ${port} --strictPort`,
    cwd: sourceRoot,
    url: `http://localhost:${port}`,
    reuseExistingServer: false,
  },
  projects: [
    { name: 'firefox', use: { browserName: 'firefox' } },
    { name: 'chromium', use: { browserName: 'chromium', channel: 'chrome' } },
    { name: 'webkit', use: { browserName: 'webkit' } },
  ],
});
