import { test, expect } from "@playwright/test";
import { ids, mockBillingApp } from "./fixtures.mjs";

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

async function expectDialogViewport(page) {
  const dialog = page.getByRole("dialog").last();
  await expect(dialog).toBeVisible();
  const bounds = await dialog.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom,
      viewport: innerWidth, height: innerHeight, client: element.clientWidth, scroll: element.scrollWidth };
  });
  expect(bounds.x).toBeGreaterThanOrEqual(8);
  expect(bounds.right).toBeLessThanOrEqual(bounds.viewport - 7);
  expect(bounds.y).toBeGreaterThanOrEqual(0);
  expect(bounds.bottom).toBeLessThanOrEqual(bounds.height + 1);
  expect(bounds.scroll).toBeLessThanOrEqual(bounds.client + 1);
  const footer = dialog.locator('[data-slot="dialog-footer"]');
  await expect(footer).toBeInViewport();
  return dialog;
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
  const payments = page.getByRole("table", { name: "External payments ledger" });
  await scrollTable(page, payments, "start");
  const expand = payments.getByRole("button", { name: /Show allocations for payment/ });
  await expect(expand).toBeInViewport();
  await expand.focus();
  await page.keyboard.press("Enter");
  await expect(payments.getByRole("button", { name: /Hide allocations for payment/ })).toHaveAttribute("aria-expanded", "true");
  await expect(payments.getByText("Allocated to 1 record", { exact: true })).toBeVisible();
  await scrollTable(page, payments, "end");
  await expect(payments.getByRole("columnheader", { name: "Unapplied cash", exact: true })).toBeInViewport();
  await expect(payments.getByRole("cell", { name: "$0.00", exact: true })).toBeInViewport();
  await page.screenshot({ path: testInfo.outputPath("payments-table-end.png") });
  await scrollTable(page, payments, "start");
  await payments.getByRole("button", { name: /Hide allocations for payment/ }).click();
  await expect(payments.getByText("Allocated to 1 record", { exact: true })).toHaveCount(0);
});

test("payer table actions and editor preserve blank and zero follow-up values", async ({ page }, testInfo) => {
  await mockBillingApp(page);
  const payerResponse = page.waitForResponse((response) =>
    new URL(response.url()).pathname.endsWith("/billing_payers") && response.request().method() === "GET",
  );
  await page.goto("/?page=medicaid-billing");
  let [payer] = await (await payerResponse).json();
  const updates = [];
  // Extend the synthetic fixture with an in-memory payer update. No backend writes.
  await page.route("**/rest/v1/billing_payers?*", async (route) => {
    const request = route.request();
    if (request.method() === "PATCH") {
      const update = request.postDataJSON();
      updates.push(update);
      payer = { ...payer, ...update };
    }
    await route.fulfill({ json: request.headers().accept?.includes("vnd.pgrst.object") ? payer : [payer] });
  });
  await page.getByRole("tab", { name: "Payers", exact: true }).click();
  const table = page.getByRole("table", { name: "Configured billing payers" });
  await scrollTable(page, table, "start");
  await expect(table.getByRole("cell", { name: payer.name, exact: true })).toBeInViewport();
  await scrollTable(page, table, "end");
  const edit = table.getByRole("button", { name: `Edit ${payer.name}`, exact: true });
  await expect(edit).toBeInViewport();
  await expect(table.getByRole("button", { name: `Deactivate ${payer.name}`, exact: true })).toBeInViewport();
  await page.screenshot({ path: testInfo.outputPath("payers-table-actions.png") });
  await edit.focus();
  await page.keyboard.press("Enter");
  let dialog = await expectDialogViewport(page);
  const cycle = dialog.getByRole("spinbutton", { name: "Follow-up cycle (days)" });
  await cycle.scrollIntoViewIfNeeded();
  await expect(cycle).toHaveValue("");
  await expect(cycle).toBeInViewport();
  await page.screenshot({ path: testInfo.outputPath("payer-unset-cycle.png") });
  await dialog.getByRole("button", { name: "Update payer", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(updates.at(-1).typical_follow_up_days).toBeNull();

  await edit.click();
  dialog = await expectDialogViewport(page);
  await dialog.getByRole("spinbutton", { name: "Follow-up cycle (days)" }).fill("0");
  await dialog.getByRole("button", { name: "Update payer", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(updates.at(-1).typical_follow_up_days).toBe(0);
  await expect(table.getByRole("cell", { name: "Every 0 days", exact: true })).toBeVisible();

  await edit.click();
  dialog = await expectDialogViewport(page);
  await expect(dialog.getByRole("spinbutton", { name: "Follow-up cycle (days)" })).toHaveValue("0");
  await dialog.getByRole("spinbutton", { name: "Follow-up cycle (days)" }).fill("");
  await dialog.getByRole("button", { name: "Update payer", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(updates.at(-1).typical_follow_up_days).toBeNull();
  await expectPageWidth(page);
});

test("authorization search and detail service lines remain usable with local scrolling", async ({ page }, testInfo) => {
  await mockBillingApp(page);
  await page.route("**/rest/v1/billing_service_agreements?*", (route) => route.fulfill({ json: [{
    id: "00000000-0000-4000-8000-000000000010", org_id: ids.org, patient_id: ids.client,
    agreement_number: "QA-SA-000012345", effective_date: "2026-01-01", expiration_date: "2026-12-31",
    status: "active", total_units_authorized: 80, total_amount_authorized: 123.2,
    patient: { full_name: "Sample Client With A Longer Name", medicaid_id: "0001234567" },
    lines: [{ id: "00000000-0000-4000-8000-000000000011", hcpcs_code: "A0425", modifier: "U1",
      units_authorized: 80, units_used: 12, unit_rate: 1.54 }],
  }] }));
  await page.goto("/?page=medicaid-billing");
  await page.getByRole("tab", { name: "Authorizations", exact: true }).click();
  const search = page.getByRole("searchbox", { name: "Search agreements" });
  await search.fill("does-not-match");
  await expect(page.getByText("No matching agreements", { exact: true })).toBeVisible();
  await search.fill("0001234567");
  const table = page.getByRole("table", { name: "Service agreements", exact: true });
  await scrollTable(page, table, "start");
  const open = table.getByRole("button", { name: "View service agreement QA-SA-000012345" });
  await expect(open).toBeInViewport();
  await scrollTable(page, table, "end");
  await expect(table.getByRole("columnheader", { name: "Status", exact: true })).toBeInViewport();
  await expect(table.getByRole("cell", { name: "active", exact: true })).toBeInViewport();
  await scrollTable(page, table, "start");
  await open.focus();
  await page.keyboard.press("Enter");
  const dialog = await expectDialogViewport(page);
  const lines = dialog.getByRole("table", { name: "Agreement service lines" });
  const container = lines.locator("..");
  await container.scrollIntoViewIfNeeded();
  const overflows = await container.evaluate((element) => element.scrollWidth > element.clientWidth);
  if (overflows) {
    await scrollTable(page, lines, "start");
    await expect(lines.getByRole("cell", { name: "A0425", exact: true })).toBeInViewport();
    await scrollTable(page, lines, "end");
  }
  await expect(lines.getByRole("columnheader", { name: "Unit rate", exact: true })).toBeInViewport();
  await expect(lines.getByRole("cell", { name: "$1.54", exact: true })).toBeInViewport();
  await expect(dialog.getByRole("button", { name: "Close", exact: true }).first()).toBeInViewport();
  await page.screenshot({ path: testInfo.outputPath("agreement-service-lines.png") });
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expectPageWidth(page);
});
