import { test, expect } from "@playwright/test";
import { mockBillingApp } from "./fixtures.mjs";

async function expectPageWidth(page) {
  const bounds = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
    main: document.querySelector('[data-slot="sidebar-inset"]')?.getBoundingClientRect().right,
  }));
  expect(bounds.document).toBeLessThanOrEqual(bounds.viewport + 1);
  expect(bounds.main).toBeLessThanOrEqual(bounds.viewport + 1);
}

async function scrollTable(page, table, edge) {
  const container = table.locator("..");
  await expect(container).toHaveAttribute("data-slot", "table-container");
  await container.scrollIntoViewIfNeeded();
  const bounds = await container.evaluate((element, edge) => {
    element.scrollLeft = edge === "end" ? element.scrollWidth : 0;
    const rect = element.getBoundingClientRect();
    return {
      client: element.clientWidth,
      scroll: element.scrollWidth,
      left: element.scrollLeft,
      x: rect.x,
      right: rect.right,
      viewport: innerWidth,
    };
  }, edge);
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.right).toBeLessThanOrEqual(bounds.viewport + 1);
  // Wide layouts can display every column without scrolling. Narrow layouts
  // must keep any extra width inside this container.
  expect(bounds.scroll).toBeGreaterThanOrEqual(bounds.client);
  if (bounds.viewport < 640) expect(bounds.scroll).toBeGreaterThan(bounds.client);
  expect(bounds.left).toBe(edge === "end" ? bounds.scroll - bounds.client : 0);
  await expectPageWidth(page);
  return container;
}

async function openBilling(page) {
  await mockBillingApp(page);
  await page.goto("/?page=medicaid-billing");
  await expect(page.getByRole("heading", { name: "Billing & Payments", exact: true })).toBeVisible();
}

test("billing and payment tables scroll locally and preserve reachable row actions", async ({ page }, testInfo) => {
  await openBilling(page);
  const records = page.getByRole("table", { name: "Billing records", exact: true });
  await expect(records).toBeVisible();
  await scrollTable(page, records, "start");
  const reference = records.getByRole("button", { name: /View billing record QA-INVOICE/ });
  await expect(reference).toBeInViewport();
  await page.screenshot({ path: testInfo.outputPath("records-table-start.png") });
  await scrollTable(page, records, "end");
  await expect(records.getByRole("columnheader", { name: "Open balance", exact: true })).toBeInViewport();
  await expect(records.getByRole("cell", { name: "$834.56", exact: true })).toBeInViewport();
  await page.screenshot({ path: testInfo.outputPath("records-table-end.png") });
  await scrollTable(page, records, "start");
  await reference.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.getByRole("tab", { name: "Payments", exact: true }).click();
  const payments = page.getByRole("table", { name: "Payments", exact: true });
  await scrollTable(page, payments, "end");
  await expect(payments.getByRole("columnheader", { name: "Amount received", exact: true })).toBeInViewport();
  await expect(payments.getByRole("cell", { name: "$400.00", exact: true })).toBeInViewport();
  await scrollTable(page, payments, "start");
  await payments.getByRole("button", { name: /QA-INVOICE/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("opening a filter preserves page geometry and scroll position", async ({ page }) => {
  await openBilling(page);
  await page.addStyleTag({ content: "body { min-height: 180vh; }" });
  const filter = page.getByRole("combobox", { name: "Agency", exact: true });
  await filter.scrollIntoViewIfNeeded();
  const measure = () => page.locator(".billing-surface").first().evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { x: rect.x, width: rect.width, scrollY: window.scrollY };
  });
  const before = await measure();
  await filter.click();
  await expect(page.getByRole("listbox")).toBeVisible();
  const opened = await measure();
  expect(Math.abs(opened.x - before.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(opened.width - before.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(opened.scrollY - before.scrollY)).toBeLessThanOrEqual(1);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("listbox")).toHaveCount(0);
  const closed = await measure();
  expect(Math.abs(closed.width - before.width)).toBeLessThanOrEqual(1);
});

test("search finds patient and literal reference text without a payer-management workflow", async ({ page }) => {
  await openBilling(page);
  const search = page.getByRole("searchbox", { name: "Search records" });
  await search.fill("Sample Client");
  await expect(page.getByRole("table", { name: "Billing records", exact: true })).toBeVisible();
  await search.fill("not present");
  await expect(page.getByText("No billing records found", { exact: true })).toBeVisible();
  await search.fill("");
  await expect(page.getByRole("table", { name: "Billing records", exact: true })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Payers", exact: true })).toHaveCount(0);
  await expect(page.getByRole("tab", { name: "Authorizations", exact: true })).toHaveCount(0);
});
