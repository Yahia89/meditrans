import { defineConfig } from '@playwright/test';

const port = process.env.DIRECTORIES_TEST_PORT ?? '5188';

export default defineConfig({
  testDir: './tests/directories-ui',
  outputDir: './test-results/directories-ui',
  fullyParallel: true,
  workers: 2,
  timeout: 45_000,
  expect: { timeout: 12_000 },
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${port}`,
    viewport: { width: 1440, height: 1000 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  // Build first: these checks exercise the deployed bundle structure.
  webServer: {
    command: `npm run preview -- --port ${port} --strictPort`,
    url: `http://localhost:${port}`,
    reuseExistingServer: true,
  },
  projects: [{ name: 'firefox', use: { browserName: 'firefox' } }],
});
