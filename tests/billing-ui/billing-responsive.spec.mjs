import { test, expect } from "@playwright/test";
import { mockBillingApp } from "./fixtures.mjs";

async function assertPageFits(page) {
  const layout = await page.evaluate(() => {
    const main = document.querySelector('[data-slot="sidebar-inset"]')?.getBoundingClientRect();
    return { width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth, right: main?.right };
  });
  expect(layout.scroll).toBeLessThanOrEqual(layout.width + 1);
  expect(layout.right).toBeLessThanOrEqual(layout.width + 1);
}

async function assertDialogFits(page) {
  const dialog = page.getByRole("dialog").last();
  await expect(dialog).toBeVisible();
  const bounds = await dialog.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const controls = [...element.querySelectorAll('input:not([type="file"]), textarea, [role="combobox"]')].map((control) => {
      const bounds = control.getBoundingClientRect();
      return { left: bounds.left, right: bounds.right, font: parseFloat(getComputedStyle(control).fontSize) };
    });
    return { x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom,
      vw: innerWidth, vh: innerHeight, width: element.clientWidth, scroll: element.scrollWidth, controls };
  });
  expect(bounds.x).toBeGreaterThanOrEqual(8);
  expect(bounds.y).toBeGreaterThanOrEqual(0);
  expect(bounds.right).toBeLessThanOrEqual(bounds.vw - 7);
  expect(bounds.bottom).toBeLessThanOrEqual(bounds.vh + 1);
  expect(bounds.scroll).toBeLessThanOrEqual(bounds.width + 1);
  for (const control of bounds.controls.filter((c) => c.right > c.left)) {
    expect(control.left).toBeGreaterThanOrEqual(bounds.x);
    expect(control.right).toBeLessThanOrEqual(bounds.right + 1);
    if (bounds.vw < 640) expect(control.font).toBeGreaterThanOrEqual(16);
  }
  const footer = dialog.locator('[data-slot="dialog-footer"]');
  if (await footer.count()) {
    const rect = await footer.boundingBox();
    expect(rect.y + rect.height).toBeLessThanOrEqual(bounds.vh + 1);
  }
  return dialog;
}

async function closeDialog(page) {
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

test("billing tabs and dialogs fit with populated records", async ({ page }, testInfo) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await mockBillingApp(page);
  await page.goto("/?page=medicaid-billing");
  await expect(page.getByRole("heading", { name: "Billing & Payments", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /QA-INVOICE/ }).first()).toBeVisible();
  await assertPageFits(page);
  await page.screenshot({ path: testInfo.outputPath("records.png"), animations: "disabled" });

  for (const name of ["Payments", "Billing records"]) {
    await page.getByRole("tab", { name, exact: true }).click();
    await expect(page.getByRole("tab", { name, exact: true })).toHaveAttribute("data-state", "active");
    await assertPageFits(page);
  }

  await expect(page.getByRole("tab", { name: "Payers", exact: true })).toHaveCount(0);
  await expect(page.getByRole("tab", { name: "Authorizations", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Record Payment", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Add billing record", exact: true }).first().click();
  const addDialog = await assertDialogFits(page);
  await expect(addDialog.getByRole("button", { name: "Add billing record", exact: true })).toBeInViewport();
  await addDialog.getByLabel("Patient *", { exact: true }).click();
  await page.getByRole("option", { name: /Sample Client/ }).click();
  await expect(addDialog.getByLabel("Internal reference", { exact: true })).toHaveValue("00000000");
  await expect(addDialog.getByLabel("Internal reference", { exact: true })).toHaveAttribute("readonly", "");
  await addDialog.getByLabel("Agency *", { exact: true }).fill("Community transport agency");
  await addDialog.getByLabel("Original submitted amount ($) *", { exact: true }).fill("1000.00");
  await addDialog.getByLabel("Amount received ($)", { exact: true }).fill("400.00");
  await expect(addDialog.getByRole("button", { name: "Attach files", exact: true })).toBeVisible();
  await assertDialogFits(page);
  await page.screenshot({ path: testInfo.outputPath("add-record.png"), animations: "disabled" });
  await closeDialog(page);

  await page.getByRole("button", { name: /QA-INVOICE/ }).first().click();
  const detail = await assertDialogFits(page);
  await expect(detail.getByRole("heading", { name: "Received amounts", exact: true })).toBeAttached();
  await expect(detail.getByRole("heading", { name: "Billing files", exact: true })).toBeAttached();
  await page.screenshot({ path: testInfo.outputPath("record-detail.png"), animations: "disabled" });
  await closeDialog(page);

  expect(errors).toEqual([]);
});

test("empty and failed billing states stay responsive", async ({ page }, testInfo) => {
  await mockBillingApp(page, { empty: true });
  await page.goto("/?page=medicaid-billing");
  await expect(page.getByRole("heading", { name: "Billing & Payments", exact: true })).toBeVisible();
  await assertPageFits(page);
  for (const name of ["Payments", "Billing records"]) {
    await page.getByRole("tab", { name, exact: true }).click();
    await assertPageFits(page);
  }
  await page.screenshot({ path: testInfo.outputPath("empty.png"), animations: "disabled" });
  await page.unroute("**/*.supabase.co/**");
  await mockBillingApp(page, { failed: true });
  await page.reload();
  await expect(page.getByText("Billing totals are unavailable")).toBeVisible({ timeout: 20_000 });
  await assertPageFits(page);
  await page.screenshot({ path: testInfo.outputPath("error.png"), animations: "disabled" });
});
