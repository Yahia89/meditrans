import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/billing-ui",
  fullyParallel: true,
  workers: 2,
  timeout: 90_000,
  expect: { timeout: 10_000 },
  reporter: "list",
  use: {
    baseURL: "http://localhost:5173",
    channel: "chrome",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev -- --port 5173",
    url: "http://localhost:5173",
    reuseExistingServer: true,
  },
  projects: [
    { name: "phone", use: { viewport: { width: 360, height: 800 }, isMobile: true, hasTouch: true } },
    { name: "phone-wide", use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
    { name: "landscape", use: { viewport: { width: 740, height: 360 }, hasTouch: true } },
    { name: "tablet", use: { viewport: { width: 768, height: 1024 }, hasTouch: true } },
    { name: "laptop", use: { viewport: { width: 1024, height: 768 } } },
    { name: "desktop", use: { viewport: { width: 1440, height: 1000 } } },
  ],
});
