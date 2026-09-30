import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import {
  billingDateTimeLocal,
  billingDateTimeToIso,
  manualBillingFormSchema,
  manualBillingRecordSchema,
  manualReceiptSchema,
  patientBillingReference,
} from "../types/manual-records.ts";

const requestId = "a0000000-0000-4000-8000-000000000001";
const patientId = "b234abcd-0000-4000-8000-000000000002";
const input = {
  request_id: requestId,
  client_id: patientId,
  agency_name: "Community Transport Agency",
  submitted_amount: "123.20",
  submitted_at: "2026-09-26T15:30:00.000Z",
};

test("manual entry uses the patient UUID prefix and requires an agency and patient", () => {
  assert.equal(patientBillingReference(patientId), "b234abcd");
  assert.equal(patientBillingReference(""), "");
  assert.equal(manualBillingRecordSchema.parse(input).submitted_amount, "123.20");
  assert.equal(manualBillingRecordSchema.parse({ ...input, agency_name: "  Agency  " }).agency_name, "Agency");
  for (const invalid of [{ ...input, client_id: "" }, { ...input, agency_name: "   " }]) {
    assert.equal(manualBillingRecordSchema.safeParse(invalid).success, false);
  }
});

test("manual entry rejects invalid monetary precision and database overflow", () => {
  for (const submitted_amount of ["0", "0.00", "-1.00", "1.005", "1e3", "NaN", "1,000.00", "10000000000.00", ""]) {
    assert.equal(manualBillingRecordSchema.safeParse({ ...input, submitted_amount }).success, false, submitted_amount);
  }
  for (const submitted_amount of ["0.01", "10", "123.20", "9999999999.99"]) {
    assert.equal(manualBillingRecordSchema.safeParse({ ...input, submitted_amount }).success, true, submitted_amount);
  }
});

test("an optional initial receipt requires a positive amount and matching chronological timestamp", () => {
  for (const receipt of [
    { received_amount: "40.00" },
    { received_at: "2026-09-27T15:30:00Z" },
    { received_amount: "0.00", received_at: "2026-09-27T15:30:00Z" },
    { received_amount: "40.00", received_at: "2026-09-26T10:00:00-05:00" },
  ]) {
    assert.equal(manualBillingRecordSchema.safeParse({ ...input, ...receipt }).success, false);
  }
  assert.equal(manualBillingRecordSchema.safeParse({
    ...input, received_amount: "140.00", received_at: "2026-09-26T11:00:00-05:00",
  }).success, true, "Actual receipts can exceed the original submission");
});

test("organization wall-clock input converts to UTC with summer and winter offsets", () => {
  assert.equal(billingDateTimeToIso("2026-09-26T10:30", "America/Chicago"), "2026-09-26T15:30:00.000Z");
  assert.equal(billingDateTimeToIso("2026-01-26T10:30", "America/Chicago"), "2026-01-26T16:30:00.000Z");
  assert.equal(billingDateTimeLocal("America/Chicago", new Date("2026-09-26T01:30:00Z")), "2026-09-25T20:30");
});

test("organization wall-clock validation rejects nonexistent DST and calendar times", () => {
  for (const value of ["2026-03-08T02:30", "2026-02-30T12:00", "2026-09-26", "2026-09-26T24:30", ""]) {
    assert.throws(() => billingDateTimeToIso(value, "America/Chicago"), /date|time/i);
  }
});

test("form validation treats empty receipt inputs as unpaid and normalizes both dates", () => {
  const schema = manualBillingFormSchema("America/Chicago");
  const unpaid = schema.parse({ ...input, submitted_at: "2026-09-26T10:30", received_amount: "", received_at: "" });
  assert.equal(unpaid.submitted_at, "2026-09-26T15:30:00.000Z");
  assert.equal(unpaid.received_amount, null);
  assert.equal(unpaid.received_at, null);
  const paid = schema.parse({ ...input, submitted_at: "2026-09-26T10:30", received_amount: "40.00", received_at: "2026-09-26T12:05" });
  assert.equal(paid.received_at, "2026-09-26T17:05:00.000Z");
});

test("receipts reject date-only values and keep payment references as text", () => {
  const receipt = { request_id: requestId, amount: "12.34", received_at: "2026-09-26T15:30:00Z", reference_number: "00000123" };
  assert.equal(manualReceiptSchema.parse(receipt).reference_number, "00000123");
  assert.equal(manualReceiptSchema.safeParse({ ...receipt, received_at: "2026-09-26" }).success, false);
});

const requirePackage = createRequire(import.meta.url);
function loadApi(database) {
  const cache = new Map();
  function load(url) {
    if (cache.has(url.href)) return cache.get(url.href);
    const source = ts.transpileModule(readFileSync(url, "utf8"), {
      fileName: url.pathname,
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    }).outputText;
    const exported = {};
    cache.set(url.href, exported);
    new Function("require", "exports", source)((id) => {
      if (id === "./client") return { billingDb: database };
      if (id.startsWith(".")) return load(new URL(id.endsWith(".ts") ? id : `${id}.ts`, url));
      return requirePackage(id);
    }, exported);
    return exported;
  }
  return load(new URL("../api/manual-records.ts", import.meta.url));
}

const response = {
  id: "record-1", org_id: "org-1", payer_id: "payer-1", client_id: patientId,
  record_type: "partner_invoice", internal_reference: "b234abcd",
  billing_period_start: "2026-09-26", billing_period_end: "2026-09-26", due_date: null,
  original_external_reference: "00001234", current_submission_attempt: 1,
  external_submitted_at: input.submitted_at, submitted_by_name: null, submission_channel: "other",
  payer_acknowledged_at: null, follow_up_owner_id: null, next_follow_up_date: null, follow_up_notes: null,
  submission_status: "submitted", adjudication_status: "not_reported", settlement_status: "partially_paid",
  total_billed_amount: 123.2, original_submitted_amount: 123.2, total_allowed_amount: null, total_paid_amount: 40,
  total_adjusted_amount: 0, outstanding_balance: 83.2, version: 1,
  is_historical: false, is_summary_only: true, provenance: "manual_entry", notes: null,
  created_at: input.submitted_at, updated_at: input.submitted_at, created_by: null, updated_by: null,
  superseded_by_record_id: null, replaces_record_id: null,
};

test("manual create atomically sends the receipt and preserves the retry ID and reference", async () => {
  const calls = [];
  const api = loadApi({ rpc: async (...args) => { calls.push(args); return { data: response, error: null }; } });
  const recordInput = { ...input, received_amount: "40.00", received_at: "2026-09-27T15:30:00Z", external_reference: "00001234" };
  const saved = await api.createManualBillingRecord("org-1", recordInput);
  await api.createManualBillingRecord("org-1", recordInput);
  assert.equal(saved.original_submitted_amount, "123.2");
  assert.equal(saved.total_paid_amount, "40");
  assert.equal(saved.internal_reference, "b234abcd");
  assert.equal(calls.length, 2);
  for (const [name, args] of calls) {
    assert.equal(name, "create_manual_billing_record");
    assert.deepEqual(args.p_record, { ...recordInput, org_id: "org-1" });
    assert.equal(args.p_record.request_id, requestId);
  }
});

test("manual create validates before writing and propagates backend failures", async () => {
  let calls = 0;
  const failure = new Error("This patient is not in your organization");
  const api = loadApi({ rpc: async () => { calls++; return { data: null, error: failure }; } });
  await assert.rejects(() => api.createManualBillingRecord("org-1", { ...input, submitted_amount: "-40" }));
  assert.equal(calls, 0);
  await assert.rejects(() => api.createManualBillingRecord("org-1", input), failure);
  assert.equal(calls, 1);
});
