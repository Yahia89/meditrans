const id = (value) => `00000000-0000-4000-8000-${String(value).padStart(12, "0")}`;
export const ids = { user: id(1), org: id(2), payer: id(3), client: id(4), record: id(5), line: id(6), payment: id(7) };
const timestamp = new Date().toISOString();
export const user = { id: ids.user, aud: "authenticated", role: "authenticated", email: "billing-qa@example.invalid", created_at: timestamp, app_metadata: {}, user_metadata: {} };
const payer = {
  id: ids.payer, org_id: ids.org, name: "Connectivity of MN — QA partner with a long billing name",
  payer_type: "broker_partner", submission_channel: "other", contact_name: null, contact_email: null,
  contact_phone: null, payment_terms: null, typical_follow_up_days: null, is_active: true,
  notes: null, created_at: timestamp, updated_at: timestamp, created_by: null,
};
const client = { id: ids.client, full_name: "Sample Client With A Longer Name", medicaid_id: "0001234567", org_id: ids.org };
const record = {
  id: ids.record, org_id: ids.org, payer_id: ids.payer, client_id: ids.client,
  record_type: "partner_invoice", internal_reference: "QA-INVOICE-0000123456789",
  billing_period_start: "2026-07-01", billing_period_end: "2026-07-31", due_date: "2026-08-31",
  original_external_reference: "000001234", current_submission_attempt: 1,
  external_submitted_at: timestamp, submitted_by_name: null, submission_channel: "other",
  payer_acknowledged_at: null, follow_up_owner_id: null, next_follow_up_date: null, follow_up_notes: null,
  submission_status: "submitted", adjudication_status: "in_review", settlement_status: "partially_paid",
  total_billed_amount: 1234.56, total_allowed_amount: null, total_paid_amount: 400,
  total_adjusted_amount: 0, outstanding_balance: 834.56, version: 1,
  is_historical: true, is_summary_only: false, provenance: "historical_backfill", notes: "Synthetic QA record.",
  created_at: timestamp, updated_at: timestamp, created_by: null, updated_by: null,
  superseded_by_record_id: null, replaces_record_id: null, payer, client,
};
const line = {
  id: ids.line, record_id: ids.record, org_id: ids.org, client_id: ids.client,
  service_date: "2026-07-10", description: "Documented historical service with a longer description",
  hcpcs_code: null, modifiers: null, quantity: 80, unit_type: "miles", unit_rate: 1.54,
  billed_amount: 123.2, allowed_amount: null, adjusted_amount: 0, paid_amount: 0,
  line_status: "submitted", service_agreement_id: null, service_agreement_line_id: null,
  trip_id: null, trip_component: null, denial_reason: null, notes: null,
  created_at: timestamp, updated_at: timestamp, client,
};
record.lines = [line];
const payment = {
  id: ids.payment, org_id: ids.org, payer_id: ids.payer, amount: 400, currency: "USD",
  payment_method: "eft", reference_number: "QA-EFT-000000001", payer_reported_date: null,
  received_date: timestamp.slice(0, 10), reconciliation_status: "fully_applied", unapplied_amount: 0,
  notes: null, created_at: timestamp, created_by: null, reconciled_at: null, reconciled_by: null, payer,
};
const allocation = { id: id(8), org_id: ids.org, payment_id: ids.payment, record_id: ids.record,
  record_line_id: null, amount: 400, allocated_at: timestamp, allocated_by: null, notes: null,
  record: { id: ids.record, internal_reference: record.internal_reference, record_type: record.record_type,
    total_billed_amount: record.total_billed_amount, outstanding_balance: record.outstanding_balance },
};
payment.allocations = [allocation];

export async function mockBillingApp(page, { empty = false, failed = false } = {}) {
  const session = { access_token: "qa." + Buffer.from(JSON.stringify({ sub: ids.user, exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url") + ".synthetic",
    refresh_token: "synthetic-qa-only", token_type: "bearer", expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600, user };
  await page.addInitScript((session) => {
    localStorage.setItem("future-transport-auth", JSON.stringify(session));
    localStorage.setItem("onboarding:dataState", "live");
  }, session);
  // All backend requests use synthetic fixtures: this suite never writes to a real project.
  await page.route("**/*.supabase.co/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname.startsWith("/auth/")) return route.fulfill({ json: user });
    if (url.pathname.includes("/rpc/")) return route.fulfill({ json: null });
    const table = url.pathname.split("/").at(-1);
    const tables = {
      organizations: [{ id: ids.org, name: "Future Transportation", created_at: timestamp, timezone: "America/Chicago", billing_enabled: true }],
      user_profiles: [{ user_id: ids.user, full_name: "Billing QA", default_org_id: ids.org, is_super_admin: false, phone: null, timezone: "America/Chicago", created_at: timestamp }],
      organization_memberships: [{ id: id(9), org_id: ids.org, user_id: ids.user, role: "admin", is_primary: true, created_at: timestamp }],
      patients: [client], billing_payers: [payer], billing_records: [record], billing_record_lines: [line],
      billing_payments: [payment], billing_payment_allocations: [{ ...allocation, payment }],
      billing_service_agreements: [{ id: id(10), org_id: ids.org, patient_id: ids.client, agreement_number: "QA-SA-000012345",
        effective_date: "2026-01-01", expiration_date: "2026-12-31", status: "active", created_at: timestamp,
        total_units_authorized: null, total_amount_authorized: null,
        patient: client, lines: [] }],
    };
    if (failed && table.startsWith("billing_")) {
      return route.fulfill({ status: 503, json: { code: "QA_UNAVAILABLE", message: "Synthetic database unavailable" } });
    }
    let data = empty && table.startsWith("billing_") ? [] : [...(tables[table] ?? [])];
    for (const [key, value] of url.searchParams) {
      if (value.startsWith("eq.")) data = data.filter((row) => String(row[key]) === value.slice(3));
    }
    const single = request.headers().accept?.includes("vnd.pgrst.object");
    return route.fulfill({
      status: 200,
      headers: { "content-range": `0-${Math.max(0, data.length - 1)}/${data.length}` },
      json: single ? (data[0] ?? null) : data,
    });
  });
  await page.routeWebSocket(/supabase\.co/, (socket) => socket.close());
}
