import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/dashboard-ui",
  fullyParallel: true,
  workers: 2,
  timeout: 45_000,
  expect: { timeout: 15_000 },
  reporter: "list",
  use: {
    baseURL: "http://localhost:5183",
    viewport: { width: 1440, height: 1000 },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  // Tests exercise the production build; run npm run build before this suite.
  webServer: {
    command: "npm run preview -- --port 5183 --strictPort",
    url: "http://localhost:5183",
    reuseExistingServer: true,
  },
  projects: [
    { name: "chromium", use: { browserName: "chromium", channel: "chrome" } },
    { name: "firefox", use: { browserName: "firefox" } },
    { name: "webkit", use: { browserName: "webkit" } },
  ],
});
