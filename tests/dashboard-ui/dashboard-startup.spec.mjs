import { expect, test } from "@playwright/test";
import { createWorkflowFixture, installWorkflowFixtures } from "../web-workflow/fixtures.mjs";

async function install(context, page) {
  const state = createWorkflowFixture({ role: "owner", status: "completed" });
  state.patient.monthly_credit = 100;
  await installWorkflowFixtures(context, () => state);
  // The shared fixture defaults to port 5173. This suite serves immutable dist.
  await page.route("http://localhost:5183/**", (route) => route.continue());
  return state;
}

function plotRequests(page) {
  const requests = [];
  page.on("request", (request) => {
    if (/\/assets\/PerformanceChartPlot-[^/]+\.js/.test(request.url())) requests.push(request.url());
  });
  return requests;
}

function creditRequests(state) {
  return state.requests.filter((request) => request.path.endsWith("/trips")
    && new URLSearchParams(request.search).get("status") === "eq.completed"
    && new URLSearchParams(request.search).get("select")?.includes("patient_id"));
}

test("visible chart starts its module before its RPC finishes and credit consumers share reads", async ({ context, page }) => {
  const state = await install(context, page);
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  let pendingBuckets = 0;
  await page.route("**/rest/v1/rpc/dashboard_trip_buckets", async (route) => {
    pendingBuckets++;
    await gate;
    await route.fallback();
  });
  const plots = plotRequests(page);
  const loadedAssets = [];
  page.on("request", (request) => {
    if (request.url().includes("/assets/")) loadedAssets.push(request.url());
  });
  await page.goto("/?page=dashboard");
  await expect(page.getByRole("heading", { name: "Fleet Performance" })).toBeVisible();
  await expect.poll(() => pendingBuckets).toBe(2);
  await expect.poll(() => plots.length).toBe(1);
  expect(await page.locator(".recharts-surface").count()).toBe(0);
  release();
  await expect(page.locator(".recharts-surface").first()).toBeVisible();
  await expect.poll(() => creditRequests(state).length).toBe(1);
  expect(state.requests.filter((request) => request.path.endsWith("/patients")
    && new URLSearchParams(request.search).get("select") === "id,full_name,monthly_credit")).toHaveLength(1);
  expect(loadedAssets.filter((asset) => /(?:vendor-(?:pdf|maps|xlsx|spreadsheet)|jspdf|xlsx|google-maps)/i.test(asset))).toEqual([]);
});

test("off-screen chart reserves space and waits until near the viewport", async ({ context, page }) => {
  const state = await install(context, page);
  await page.addInitScript(() => {
    const style = document.createElement("style");
    style.textContent = "#dashboard-activity { margin-top: 1800px !important; }";
    document.documentElement.append(style);
  });
  const plots = plotRequests(page);
  await page.goto("/?page=dashboard");
  await expect(page.getByRole("heading", { name: "Operational Schedule" })).toBeAttached();
  await expect.poll(() => state.requests.filter((request) => request.path.endsWith("/dashboard_trip_buckets")).length).toBe(1);
  expect(plots).toHaveLength(0);
  await page.getByRole("heading", { name: "Fleet Performance" }).scrollIntoViewIfNeeded();
  await expect(page.locator(".recharts-surface").first()).toBeVisible();
  expect(plots).toHaveLength(1);
  expect(state.requests.filter((request) => request.path.endsWith("/dashboard_trip_buckets"))).toHaveLength(2);
});

test("failed credit reads never claim healthy balances", async ({ context, page }) => {
  await install(context, page);
  await page.route("**/rest/v1/trips?*", async (route) => {
    const search = new URL(route.request().url()).searchParams;
    if (search.get("status") !== "eq.completed" || !search.get("select")?.includes("patient_id")) return route.fallback();
    return route.fulfill({ status: 403, json: { code: "42501", message: "Synthetic credit permission failure" } });
  });
  await page.goto("/?page=dashboard");
  await expect(page.getByText("Unable to check credit balances. Please try again.")).toBeVisible();
  await expect(page.getByText("Credit Health Good")).toHaveCount(0);
  await page.getByRole("button", { name: /unread notifications/ }).click();
  await expect(page.getByText("Unable to check credit balances.", { exact: true })).toBeVisible();
});
