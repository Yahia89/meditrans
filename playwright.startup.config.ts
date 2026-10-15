import { defineConfig } from "@playwright/test";

const port = process.env.STARTUP_TEST_PORT ?? '5184';

export default defineConfig({
  testDir: "./tests/startup-ui",
  outputDir: "./test-results/startup-ui",
  fullyParallel: true,
  workers: 2,
  timeout: 45_000,
  expect: { timeout: 12_000 },
  reporter: "list",
  use: {
    baseURL: `http://localhost:${port}`,
    viewport: { width: 1440, height: 1000 },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  // Build before running; startup tests must not benchmark Vite's dev server.
  webServer: {
    command: `npm run preview -- --port ${port} --strictPort`,
    url: `http://localhost:${port}`,
    reuseExistingServer: false,
  },
  projects: [
    { name: "chromium", use: { browserName: "chromium", channel: "chrome" } },
    { name: "firefox", use: { browserName: "firefox" } },
    { name: "webkit", use: { browserName: "webkit" } },
  ],
});
