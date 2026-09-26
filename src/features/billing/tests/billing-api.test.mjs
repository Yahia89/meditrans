import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";

const requirePackage = createRequire(import.meta.url);

// Exercise the actual API functions with deterministic PostgREST responses.
// This follows the repository's existing TypeScript source-test loader pattern.
function loadSource(relativePath, billingDb, cache = new Map()) {
  const url = new URL(relativePath, import.meta.url);
  function load(url) {
    if (cache.has(url.href)) return cache.get(url.href);
    const code = ts.transpileModule(readFileSync(url, "utf8"), {
      fileName: url.pathname,
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    }).outputText;
    const exported = {};
    cache.set(url.href, exported);
    new Function("require", "exports", code)((id) => {
      if (id === "./client") return { billingDb };
      if (id.startsWith(".")) {
        return load(new URL(id.endsWith(".ts") ? id : `${id}.ts`, url));
      }
      return requirePackage(id);
    }, exported);
    return exported;
  }
  return load(url);
}

function databaseStub(tables, failedTable) {
  const failure = new Error("Database connection unavailable");
  const requests = [];
  return {
    failure,
    requests,
    from(table) {
      let rows = [...(tables[table] ?? [])];
      let single = false;
      requests.push(table);
      const query = {
        select() { return query; },
        order() { return query; },
        eq(field, value) { rows = rows.filter((row) => row[field] === value); return query; },
        gte(field, value) { rows = rows.filter((row) => row[field] >= value); return query; },
        lte(field, value) { rows = rows.filter((row) => row[field] <= value); return query; },
        in(field, values) { rows = rows.filter((row) => values.includes(row[field])); return query; },
        not(field, operator, values) {
          assert.equal(operator, "in");
          const excluded = values.replace(/[()"']/g, "").split(",");
          rows = rows.filter((row) => !excluded.includes(row[field]));
          return query;
        },
        single() { single = true; return query; },
        then(resolve, reject) {
          return Promise.resolve(table === failedTable
            ? { data: null, error: failure }
            : { data: single ? rows[0] : rows, error: null }).then(resolve, reject);
        },
      };
      return query;
    },
  };
}

const recordFixture = (overrides = {}) => ({
  id: "record-1", org_id: "org-1", payer_id: "payer-1", client_id: "client-1",
  record_type: "dhs_claim", internal_reference: "MANUAL-001",
  billing_period_start: "2026-07-01", billing_period_end: "2026-07-31",
  due_date: null, original_external_reference: "00001234",
  current_submission_attempt: 1, external_submitted_at: new Date().toISOString(),
  submitted_by_name: null, submission_channel: "mn_its_dde", payer_acknowledged_at: null,
  follow_up_owner_id: null, next_follow_up_date: null, follow_up_notes: null,
  submission_status: "submitted", adjudication_status: "not_reported", settlement_status: "unpaid",
  total_billed_amount: 123.2, total_allowed_amount: null, total_paid_amount: 0,
  total_adjusted_amount: 0, outstanding_balance: 123.2, version: 1,
  is_historical: false, is_summary_only: false, provenance: "manual_entry", notes: null,
  created_at: "2026-09-25T00:00:00Z", updated_at: "2026-09-25T00:00:00Z",
  created_by: null, updated_by: null, superseded_by_record_id: null, replaces_record_id: null,
  ...overrides,
});

test("billing API normalizes numeric money and preserves string external references", async () => {
  const db = databaseStub({ billing_records: [recordFixture()] });
  const { getBillingRecords } = loadSource("../api/records.ts", db);
  const [record] = await getBillingRecords({ orgId: "org-1" });
  assert.equal(record.total_billed_amount, "123.2");
  assert.equal(record.total_paid_amount, "0");
  assert.equal(record.original_external_reference, "00001234");
  assert.equal(record.total_allowed_amount, null);
});

test("billing API rejects malformed amounts, unknown statuses, and incomplete claim identity", async () => {
  for (const invalid of [
    { total_billed_amount: "not-a-decimal" },
    { total_billed_amount: Infinity },
    { submission_status: "automatically_sent" },
    { client_id: null },
  ]) {
    const db = databaseStub({ billing_records: [recordFixture(invalid)] });
    const { getBillingRecords } = loadSource("../api/records.ts", db);
    await assert.rejects(getBillingRecords({ orgId: "org-1" }), { name: "ZodError" });
  }
});

test("partner invoice response permits record-level client to be absent", async () => {
  const db = databaseStub({ billing_records: [recordFixture({ record_type: "partner_invoice", client_id: null })] });
  const { getBillingRecords } = loadSource("../api/records.ts", db);
  const [record] = await getBillingRecords({ orgId: "org-1" });
  assert.equal(record.record_type, "partner_invoice");
  assert.equal(record.client_id, null);
});

test("historical service lines preserve missing trip and authorization links", () => {
  const { billingLineResponseSchema } = loadSource("../types/responses.ts");
  const line = billingLineResponseSchema.parse({
    id: "line-1", record_id: "record-1", org_id: "org-1", client_id: "client-1",
    service_date: "2026-07-10", description: "Documented historical service",
    hcpcs_code: null, modifiers: null, quantity: 80, unit_type: "miles",
    unit_rate: 1.54, billed_amount: 123.2, allowed_amount: null,
    adjusted_amount: 0, paid_amount: 0, line_status: "submitted",
    service_agreement_id: null, service_agreement_line_id: null,
    trip_id: null, trip_component: null, denial_reason: null, notes: null,
    created_at: "2026-09-25T00:00:00Z", updated_at: "2026-09-25T00:00:00Z", client: null,
  });
  assert.equal(line.trip_component, null);
  assert.equal(line.service_agreement_id, null);
  assert.equal(line.unit_rate, "1.54");
  assert.equal(line.billed_amount, "123.2");
});

test("each failed record-detail query rejects instead of returning empty financial history", async () => {
  for (const table of [
    "billing_records", "billing_record_lines", "billing_submission_attempts",
    "billing_payer_responses", "billing_payment_allocations", "billing_adjustments",
    "billing_activity_logs", "billing_documents",
  ]) {
    const db = databaseStub({ billing_records: [recordFixture()] }, table);
    const { getBillingRecordById } = loadSource("../api/records.ts", db);
    await assert.rejects(getBillingRecordById("record-1"), (error) => error === db.failure);
  }
});

test("overview counts a rejected record once and sums confirmed payment headers once", async () => {
  const db = databaseStub({
    billing_records: [recordFixture({ submission_status: "rejected" })],
    billing_payments: [{ org_id: "org-1", amount: 1000, received_date: new Date().toISOString().slice(0, 10) }],
  });
  const { getBillingOverviewStats } = loadSource("../api/summary.ts", db);
  const stats = await getBillingOverviewStats("org-1");
  assert.equal(stats.actionNeededCount, 1);
  assert.equal(stats.receivedThisMonth, "1000.00");
  assert.equal(stats.outstandingBalance, "123.20");
});

test("overview never substitutes the service period for a missing submission date", async () => {
  const today = new Date().toISOString().slice(0, 10);
  const db = databaseStub({
    billing_records: [recordFixture({ external_submitted_at: null, billing_period_start: today })],
  });
  const { getBillingOverviewStats } = loadSource("../api/summary.ts", db);
  const stats = await getBillingOverviewStats("org-1");
  assert.equal(stats.billedThisMonth, "0.00");
});

test("overview database errors remain errors instead of zero balances", async () => {
  for (const table of ["billing_records", "billing_payments"]) {
    const db = databaseStub({}, table);
    const { getBillingOverviewStats } = loadSource("../api/summary.ts", db);
    await assert.rejects(getBillingOverviewStats("org-1"), (error) => error === db.failure);
  }
});
