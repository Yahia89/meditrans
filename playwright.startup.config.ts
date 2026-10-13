import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/startup-ui",
  outputDir: "./test-results/startup-ui",
  fullyParallel: true,
  workers: 2,
  timeout: 45_000,
  expect: { timeout: 12_000 },
  reporter: "list",
  use: {
    baseURL: "http://localhost:5184",
    viewport: { width: 1440, height: 1000 },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  // Build before running; startup tests must not benchmark Vite's dev server.
  webServer: {
    command: "npm run preview -- --port 5184 --strictPort",
    url: "http://localhost:5184",
    reuseExistingServer: true,
  },
  projects: [
    { name: "chromium", use: { browserName: "chromium", channel: "chrome" } },
    { name: "firefox", use: { browserName: "firefox" } },
    { name: "webkit", use: { browserName: "webkit" } },
  ],
});
