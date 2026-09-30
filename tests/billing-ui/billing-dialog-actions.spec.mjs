import { test, expect } from "@playwright/test";
import { mockBillingApp, ids } from "./fixtures.mjs";

async function openBilling(page) {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await mockBillingApp(page);
  await page.goto("/?page=medicaid-billing");
  await expect(page.getByRole("heading", { name: "Billing & Payments", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /View billing record QA-INVOICE/ }).first()).toBeVisible();
  return errors;
}

async function openDetail(page) {
  await page.getByRole("button", { name: /View billing record QA-INVOICE/ }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Sample Client With A Longer Name", exact: true })).toBeVisible();
  return dialog;
}

async function assertDialogLayout(dialog) {
  const bounds = await dialog.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom,
      viewportWidth: innerWidth, viewportHeight: innerHeight,
      width: element.clientWidth, scrollWidth: element.scrollWidth,
      controls: [...element.querySelectorAll('input:not([type="file"]), textarea, [role="combobox"]')].filter((control) => control.getClientRects().length > 0).map((control) => {
        const box = control.getBoundingClientRect();
        return { left: box.left, right: box.right, fontSize: parseFloat(getComputedStyle(control).fontSize) };
      }),
    };
  });
  expect(bounds.left).toBeGreaterThanOrEqual(8);
  expect(bounds.top).toBeGreaterThanOrEqual(0);
  expect(bounds.right).toBeLessThanOrEqual(bounds.viewportWidth - 7);
  expect(bounds.bottom).toBeLessThanOrEqual(bounds.viewportHeight + 1);
  expect(bounds.scrollWidth).toBeLessThanOrEqual(bounds.width + 1);
  for (const control of bounds.controls) {
    expect(control.left).toBeGreaterThanOrEqual(bounds.left);
    expect(control.right).toBeLessThanOrEqual(bounds.right + 1);
    if (bounds.viewportWidth < 640) expect(control.fontSize).toBeGreaterThanOrEqual(16);
  }
  await expect(dialog.locator('[data-slot="dialog-footer"]')).toBeInViewport({ ratio: 1 });
}

test("record details show submission and receipt totals with one inline receipt form", async ({ page }) => {
  const errors = await openBilling(page);
  const detail = await openDetail(page);
  await expect(detail.getByText("Original submitted", { exact: true })).toBeVisible();
  await expect(detail.getByText("$1,234.56", { exact: true })).toBeVisible();
  await expect(detail.getByText("$834.56", { exact: true })).toBeVisible();
  await expect(detail.getByRole("tab")).toHaveCount(0);
  await expect(detail.getByRole("button", { name: /Record (Payment|Response|Submission)|Adjustment/ })).toHaveCount(0);
  await detail.getByRole("button", { name: "Add received amount", exact: true }).click();
  const form = detail.getByRole("form", { name: "Add received amount", exact: true });
  await form.getByLabel("Amount received ($)", { exact: true }).fill("100.25");
  await form.getByLabel("Received date and time", { exact: true }).fill("2026-12-01T10:30");
  await form.getByLabel("Payment reference (optional)", { exact: true }).fill("CHECK-000012");
  await form.getByLabel("Notes (optional)", { exact: true }).fill("Synthetic form check; no payment is submitted.");
  await assertDialogLayout(detail);
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await form.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(form).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("receipt retry preserves the request id and cannot create another payment", async ({ page }) => {
  const errors = await openBilling(page);
  const requests = [];
  await page.route("**/rest/v1/rpc/record_billing_receipt", async (route) => {
    const body = route.request().postDataJSON();
    requests.push(body);
    if (requests.length === 1) return route.fulfill({ status: 503, json: { message: "Response temporarily unavailable" } });
    return route.fulfill({ json: {
      id: ids.payment, org_id: ids.org, payer_id: ids.payer, amount: body.p_receipt.amount, currency: "USD",
      payment_method: "other", reference_number: "RECEIPT-QA", payer_reported_date: null,
      received_at: body.p_receipt.received_at, received_date: "2026-12-01", reconciliation_status: "fully_applied", unapplied_amount: 0,
      notes: null, created_at: "2026-12-01T16:30:00Z", created_by: ids.user, reconciled_at: null, reconciled_by: null,
    } });
  });
  const detail = await openDetail(page);
  await detail.getByRole("button", { name: "Add received amount", exact: true }).click();
  const form = detail.getByRole("form", { name: "Add received amount", exact: true });
  await form.getByLabel("Amount received ($)", { exact: true }).fill("100.25");
  await form.getByLabel("Received date and time", { exact: true }).fill("2026-12-01T10:30");
  await form.getByRole("button", { name: "Save received amount", exact: true }).click();
  await expect(form.getByRole("alert")).toContainText("Retry to safely confirm this same receipt");
  await expect(form.getByLabel("Amount received ($)", { exact: true })).toBeDisabled();
  await form.getByRole("button", { name: "Retry receipt", exact: true }).click();
  await expect(form).toHaveCount(0);
  expect(requests).toHaveLength(2);
  expect(requests[1]).toEqual(requests[0]);
  expect(requests[0].p_record_id).toBe(ids.record);
  expect(requests[0].p_receipt.received_at).toBe("2026-12-01T16:30:00.000Z");
  expect(errors).toEqual([]);
});

test("billing files can be selected and removed without a financial action", async ({ page }) => {
  const errors = await openBilling(page);
  const detail = await openDetail(page);
  await detail.getByLabel("Choose billing files", { exact: true }).setInputFiles([
    { name: "claim.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.7 synthetic") },
    { name: "receipt.csv", mimeType: "text/csv", buffer: Buffer.from("amount,date\n100,2026-09-26") },
  ]);
  await expect(detail.getByRole("list", { name: "Selected billing files" }).getByRole("listitem")).toHaveCount(2);
  await expect(detail.getByRole("button", { name: "Upload 2 files", exact: true })).toBeVisible();
  await detail.getByRole("button", { name: "Remove claim.pdf", exact: true }).click();
  await expect(detail.getByRole("button", { name: "Upload file", exact: true })).toBeVisible();
  await assertDialogLayout(detail);
  expect(errors).toEqual([]);
});

test("add billing record derives the patient reference and keeps only manual tracking fields", async ({ page }) => {
  const errors = await openBilling(page);
  await page.getByRole("button", { name: "Add billing record", exact: true }).first().click();
  const dialog = page.getByRole("dialog", { name: "Add billing record", exact: true });
  await dialog.getByLabel("Patient *", { exact: true }).click();
  await page.getByRole("option", { name: /Sample Client/ }).click();
  await expect(dialog.getByLabel("Internal reference", { exact: true })).toHaveValue(ids.client.split("-")[0]);
  await expect(dialog.getByLabel("Internal reference", { exact: true })).toHaveAttribute("readonly", "");
  await dialog.getByLabel("Agency *", { exact: true }).fill("Sample agency");
  await dialog.getByLabel("Original submitted amount ($) *", { exact: true }).fill("1234.56");
  await dialog.getByLabel("Submitted date & time *", { exact: true }).fill("2026-09-20T09:00");
  await dialog.getByLabel("Amount received ($)", { exact: true }).fill("400");
  await dialog.getByLabel("Received date & time", { exact: true }).fill("2026-09-26T10:30");
  await expect(dialog.getByRole("switch")).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: "Add Service Line", exact: true })).toHaveCount(0);
  await assertDialogLayout(dialog);
  await expect(dialog.getByRole("button", { name: "Add billing record", exact: true })).toBeInViewport({ ratio: 1 });
  expect(errors).toEqual([]);
});

test("keyboard focus returns to the add-record and detail openers after Escape", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const errors = await openBilling(page);
  const addButton = page.getByRole("button", { name: "Add billing record", exact: true }).first();
  await addButton.focus();
  await page.keyboard.press("Enter");
  const addRecord = page.getByRole("dialog", { name: "Add billing record", exact: true });
  await expect(addRecord).toBeVisible();
  await addRecord.getByRole("button", { name: "Close", exact: true }).focus();
  await page.keyboard.press("Tab");
  await expect.poll(() => addRecord.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  await page.keyboard.press("Escape");
  await expect(addRecord).toBeHidden();
  await expect(addButton).toBeFocused();
  const rowButton = page.getByRole("button", { name: /View billing record QA-INVOICE/ }).first();
  await rowButton.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(rowButton).toBeFocused();
  expect(errors).toEqual([]);
});
