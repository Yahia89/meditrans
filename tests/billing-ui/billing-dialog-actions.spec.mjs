import { test, expect } from "@playwright/test";
import { mockBillingApp } from "./fixtures.mjs";

async function openBilling(page, { draft = false } = {}) {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await mockBillingApp(page);
  const recordsLoaded = page.waitForResponse((response) =>
    new URL(response.url()).pathname.endsWith("/rest/v1/billing_records"),
  );
  await page.goto("/?page=medicaid-billing");
  const recordsResponse = await recordsLoaded;

  if (draft) {
    // Reuse the fixture response for a draft-only scenario. No live request is made.
    const [record] = await recordsResponse.json();
    const draftRecord = {
      ...record,
      submission_status: "draft",
      adjudication_status: "not_reported",
      current_submission_attempt: 0,
      external_submitted_at: null,
    };
    await page.route(
      (url) => url.hostname.endsWith(".supabase.co") && url.pathname.endsWith("/rest/v1/billing_records"),
      (route) => route.fulfill({
        json: route.request().headers().accept?.includes("vnd.pgrst.object")
          ? draftRecord
          : [draftRecord],
      }),
    );
    await page.reload();
  }

  await expect(page.getByRole("heading", { name: "Billing & Payments", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /QA-INVOICE/ }).first()).toBeVisible();
  return errors;
}

async function openDetail(page) {
  await page.getByRole("button", { name: /QA-INVOICE/ }).first().click();
  const detail = page.getByRole("dialog").last();
  await expect(detail.getByRole("heading", { name: /QA-INVOICE/ })).toBeVisible();
  return detail;
}

async function assertDialogLayout(dialog) {
  await expect(dialog).toBeVisible();
  const bounds = await dialog.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom,
      viewportWidth: innerWidth, viewportHeight: innerHeight,
      width: element.clientWidth, scrollWidth: element.scrollWidth,
      controls: [...element.querySelectorAll('input:not([type="file"]), textarea, [role="combobox"]')].map((control) => {
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
  const footer = dialog.locator('[data-slot="dialog-footer"]');
  await expect(footer).toBeInViewport({ ratio: 1 });
  return footer;
}

async function assertSelectLayout(page) {
  const listbox = page.getByRole("listbox");
  await expect(listbox).toBeVisible();
  const bounds = await listbox.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: innerWidth, height: innerHeight };
  });
  expect(bounds.left).toBeGreaterThanOrEqual(0);
  expect(bounds.right).toBeLessThanOrEqual(bounds.width + 1);
  expect(bounds.top).toBeGreaterThanOrEqual(0);
  expect(bounds.bottom).toBeLessThanOrEqual(bounds.height + 1);
}

test("response and adjustment actions stay usable inside record details", async ({ page }, testInfo) => {
  const errors = await openBilling(page);
  let detail = await openDetail(page);
  await detail.getByRole("button", { name: "Record Response", exact: true }).click();
  const response = page.getByRole("dialog", { name: "Record Payer Response", exact: true });
  await assertDialogLayout(response);
  await response.getByLabel("Response Type *", { exact: true }).click();
  await assertSelectLayout(page);
  await page.getByRole("option", { name: "Partial Approval / Reduction", exact: true }).click();
  await response.getByLabel("Normalized Adjudication Status", { exact: true }).click();
  await page.getByRole("option", { name: "Partially Approved", exact: true }).click();
  await response.getByLabel("Follow-up / Internal Notes", { exact: true }).fill("Synthetic layout check; no financial action is submitted.");
  await assertDialogLayout(response);
  await expect(response.getByRole("button", { name: "Save Payer Response", exact: true })).toBeInViewport({ ratio: 1 });
  await page.screenshot({ animations: "disabled", path: testInfo.outputPath("response-notes-and-actions.png") });
  await response.getByRole("button", { name: "Cancel", exact: true }).click();

  detail = page.getByRole("dialog").last();
  await detail.getByRole("button", { name: "Adjustment", exact: true }).click();
  const adjustment = page.getByRole("dialog", { name: "Record Adjustment", exact: true });
  await assertDialogLayout(adjustment);
  await adjustment.getByLabel("Adjustment Type *", { exact: true }).click();
  await assertSelectLayout(page);
  await page.getByRole("option", { name: "Discretionary Authorized Write-off", exact: true }).click();
  await adjustment.getByLabel("Adjustment Amount ($) *", { exact: true }).fill("15.00");
  await adjustment.getByLabel("Required Reason & Authority *", { exact: true }).fill("Synthetic responsive-form validation only.");
  await assertDialogLayout(adjustment);
  await expect(adjustment.getByRole("button", { name: "Post Adjustment", exact: true })).toBeInViewport({ ratio: 1 });
  await page.screenshot({ animations: "disabled", path: testInfo.outputPath("adjustment-reason-and-actions.png") });
  await adjustment.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(errors).toEqual([]);
});

test("a draft opens the external submission form with reachable actions", async ({ page }, testInfo) => {
  const errors = await openBilling(page, { draft: true });
  const detail = await openDetail(page);
  await detail.getByRole("button", { name: "Record Submission", exact: true }).click();
  const submission = page.getByRole("dialog", { name: "Record External Submission", exact: true });
  await assertDialogLayout(submission);
  await submission.getByLabel("Submission Channel *", { exact: true }).click();
  await assertSelectLayout(page);
  await page.getByRole("option", { name: "Partner Web Portal", exact: true }).click();
  await submission.getByLabel("External Reference / Claim Control #", { exact: true }).fill("000001234-QA");
  await submission.getByLabel("Submission Notes", { exact: true }).fill("Synthetic confirmation from outside this system; form is not saved.");
  await assertDialogLayout(submission);
  await expect(submission.getByRole("button", { name: "Confirm External Submission", exact: true })).toBeInViewport({ ratio: 1 });
  await page.screenshot({ animations: "disabled", path: testInfo.outputPath("external-submission-and-actions.png") });
  await submission.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(errors).toEqual([]);
});

test("payment allocation rows can be edited and removed without horizontal overflow", async ({ page }, testInfo) => {
  const errors = await openBilling(page);
  await page.getByRole("button", { name: "Record Payment", exact: true }).first().click();
  const payment = page.getByRole("dialog", { name: "Record Payment & Allocations", exact: true });
  await payment.getByLabel("Payer *", { exact: true }).click();
  await page.getByRole("option", { name: /Connectivity/ }).click();
  await payment.getByLabel("Total Payment Amount ($) *", { exact: true }).fill("1000.00");
  await payment.getByRole("button", { name: "Allocate to Record", exact: true }).click();
  await payment.getByLabel("Amount ($)", { exact: true }).fill("400.00");
  await payment.getByLabel("Target Record", { exact: true }).click();
  await assertSelectLayout(page);
  await page.getByRole("option", { name: /QA-INVOICE/ }).click();
  await assertDialogLayout(payment);
  await expect(payment.locator("strong").filter({ hasText: "$600.00" })).toBeVisible();
  await expect(payment.getByRole("button", { name: "Save Payment", exact: true })).toBeInViewport({ ratio: 1 });
  await page.screenshot({ animations: "disabled", path: testInfo.outputPath("payment-allocation-editor.png") });
  await payment.getByRole("button", { name: "Remove allocation 1", exact: true }).click();
  await expect(payment.getByLabel("Amount ($)", { exact: true })).toHaveCount(0);
  await expect(payment.getByText("No records allocated yet.", { exact: false })).toBeVisible();
  await assertDialogLayout(payment);
  expect(errors).toEqual([]);
});

test("multiple service lines scroll inside the add-record dialog while actions remain reachable", async ({ page }, testInfo) => {
  const errors = await openBilling(page);
  await page.getByRole("button", { name: "Add Billing Record", exact: true }).first().click();
  const addRecord = page.getByRole("dialog", { name: "Add Billing Record", exact: true });
  await addRecord.getByRole("button", { name: "Add Service Line", exact: true }).click();
  await addRecord.getByRole("button", { name: "Add Service Line", exact: true }).click();
  await expect(addRecord.getByLabel("Billed ($) *", { exact: true })).toHaveCount(3);
  await addRecord.getByLabel("Billed ($) *", { exact: true }).last().fill("42.25");
  await assertDialogLayout(addRecord);

  await addRecord.getByRole("switch", { name: "Record Billing Already Submitted Externally", exact: true }).click();
  await addRecord.getByLabel("Actual External Submission Date *", { exact: true }).fill("2026-07-20");
  await addRecord.getByLabel("Notes / Documentation", { exact: true }).fill("Three synthetic service lines; no record is created.");
  const scroller = addRecord.locator('[class*="@container/billing-dialog"]');
  const scroll = await scroller.evaluate((element) => ({ top: element.scrollTop, height: element.clientHeight, fullHeight: element.scrollHeight }));
  expect(scroll.fullHeight).toBeGreaterThan(scroll.height);
  expect(scroll.top).toBeGreaterThan(0);
  await assertDialogLayout(addRecord);
  const save = addRecord.getByRole("button", { name: "Record External Submission", exact: true });
  await expect(save).toBeInViewport({ ratio: 1 });
  await page.keyboard.press("Tab");
  await expect(addRecord.getByRole("button", { name: "Cancel", exact: true })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(save).toBeFocused();
  await page.screenshot({ animations: "disabled", path: testInfo.outputPath("multiple-lines-scroll-and-actions.png") });
  expect(errors).toEqual([]);
});

test("keyboard focus stays inside dialogs and returns to the opener after Escape", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const errors = await openBilling(page);
  const addButton = page.getByRole("button", { name: "Add Billing Record", exact: true }).first();
  await addButton.focus();
  await page.keyboard.press("Enter");
  const addRecord = page.getByRole("dialog", { name: "Add Billing Record", exact: true });
  await expect(addRecord).toBeVisible();
  const animationDuration = await addRecord.evaluate((element) => Math.max(...getComputedStyle(element).animationDuration.split(",").map(parseFloat)));
  expect(animationDuration).toBeLessThanOrEqual(0.001);
  await addRecord.getByRole("button", { name: "Close", exact: true }).focus();
  await page.keyboard.press("Tab");
  await expect.poll(() => addRecord.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  await page.keyboard.press("Shift+Tab");
  await expect.poll(() => addRecord.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  await page.keyboard.press("Escape");
  await expect(addRecord).toBeHidden();
  await expect(addButton).toBeFocused();

  const rowButton = page.getByRole("button", { name: /QA-INVOICE/ }).first();
  await rowButton.focus();
  await page.keyboard.press("Enter");
  const detail = page.getByRole("dialog").last();
  const responseButton = detail.getByRole("button", { name: "Record Response", exact: true });
  await responseButton.focus();
  await page.keyboard.press("Enter");
  const response = page.getByRole("dialog", { name: "Record Payer Response", exact: true });
  await expect(response).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(response).toBeHidden();
  await expect(responseButton).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(rowButton).toBeFocused();
  expect(errors).toEqual([]);
});
