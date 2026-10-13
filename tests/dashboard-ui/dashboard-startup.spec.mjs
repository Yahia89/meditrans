import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { createWorkflowFixture, installWorkflowFixtures } from "../web-workflow/fixtures.mjs";

const appOrigin = `http://localhost:${process.env.DASHBOARD_TEST_PORT ?? "5183"}`;
const dist = new URL("../../dist/", import.meta.url);
const manifest = JSON.parse(readFileSync(new URL(".vite/manifest.json", dist), "utf8"));
// Rolldown may call the Maps library simply "esm". Inspect its API-loader
// signature as well as module names so the assertion survives chunk renaming.
const optionalLibraryAssets = new Set(Object.values(manifest)
  .filter((chunk) => chunk.file.endsWith(".js") && (
    /jspdf|xlsx|pdf-generator|devtools/i.test(chunk.name ?? chunk.file)
    || /@react-google-maps\/api load script|Google Maps JavaScript API|(?:React|TanStack) (?:Query|Router) Devtools/.test(readFileSync(new URL(chunk.file, dist), "utf8"))
  ))
  .map((chunk) => `/${chunk.file}`));

async function install(context, page) {
  const state = createWorkflowFixture({ role: "owner", status: "completed" });
  state.patient.monthly_credit = 100;
  await installWorkflowFixtures(context, () => state);
  // The shared fixture defaults to port 5173. This suite serves immutable dist.
  await page.route(`${appOrigin}/**`, (route) => route.continue());
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
    loadedAssets.push(request.url());
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
  expect(loadedAssets.filter((asset) => optionalLibraryAssets.has(new URL(asset).pathname)
    || /maps\.googleapis\.com\/maps\/api\/js/.test(asset))).toEqual([]);
});

test("off-screen chart reserves space and waits until near the viewport", async ({ context, page }) => {
  const state = await install(context, page);
  // Install layout before application JS/IntersectionObserver runs. An init
  // script can run before documentElement exists and would not reserve space.
  await page.route(`${appOrigin}/**`, async (route) => {
    if (new URL(route.request().url()).pathname !== "/") return route.continue();
    const response = await route.fetch();
    return route.fulfill({ response, body: (await response.text()).replace("<head>",
      "<head><style>#dashboard-activity { margin-top: 1800px !important; }</style>") });
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
