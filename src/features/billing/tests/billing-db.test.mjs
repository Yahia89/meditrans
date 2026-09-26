import assert from "node:assert/strict";
import test from "node:test";
import { execFileSync } from "node:child_process";

function runSql(sql) {
  // Keep fixture queries in the local test container and pass SQL without a shell.
  const output = execFileSync(
    "docker",
    ["exec", "-i", "supabase_db_futuretransportation", "psql", "-U", "postgres", "-d", "postgres", "-q", "-t", "-A", "-v", "ON_ERROR_STOP=1", "-c", sql],
    { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }
  );
  const lines = output
    .trim()
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !/^(INSERT|UPDATE|DELETE|SET)\b/.test(l));
  return lines.length > 0 ? lines[lines.length - 1] : "";
}

// Global fixtures for DB tests
let testOrgId;
let testAdminId;
let testDispatchId;
let testDisabledId;
let testPatientId;
let testPayerDhsId;
let testPayerConnId;
let testTripId;

test.before(() => {
  // Create test organization
  testOrgId = runSql(`
    INSERT INTO organizations (name, slug)
    VALUES ('Billing Test Org ' || gen_random_uuid(), 'billing-test-' || gen_random_uuid())
    RETURNING id;
  `);

  // Create users in auth.users
  testAdminId = runSql(`
    INSERT INTO auth.users (id, email, raw_user_meta_data)
    VALUES (gen_random_uuid(), 'billing-admin-' || gen_random_uuid() || '@test.com', '{"full_name":"Billing Admin"}'::jsonb)
    RETURNING id;
  `);

  testDispatchId = runSql(`
    INSERT INTO auth.users (id, email, raw_user_meta_data)
    VALUES (gen_random_uuid(), 'billing-dispatch-' || gen_random_uuid() || '@test.com', '{"full_name":"Billing Dispatch"}'::jsonb)
    RETURNING id;
  `);

  testDisabledId = runSql(`
    INSERT INTO auth.users (id, email, raw_user_meta_data)
    VALUES (gen_random_uuid(), 'billing-disabled-' || gen_random_uuid() || '@test.com', '{"full_name":"Billing Disabled"}'::jsonb)
    RETURNING id;
  `);

  // Profiles
  runSql(`
    INSERT INTO user_profiles (user_id, full_name, default_org_id)
    VALUES 
      ('${testAdminId}', 'Billing Admin', '${testOrgId}'),
      ('${testDispatchId}', 'Billing Dispatch', '${testOrgId}'),
      ('${testDisabledId}', 'Billing Disabled', '${testOrgId}');
  `);

  // Memberships
  runSql(`
    INSERT INTO organization_memberships (org_id, user_id, role)
    VALUES 
      ('${testOrgId}', '${testAdminId}', 'admin'),
      ('${testOrgId}', '${testDispatchId}', 'dispatch'),
      ('${testOrgId}', '${testDisabledId}', 'admin');
  `);

  // Mark disabled user as disabled in employees
  runSql(`
    INSERT INTO employees (org_id, user_id, email, full_name, disabled)
    VALUES ('${testOrgId}', '${testDisabledId}', 'disabled@test.com', 'Disabled User', true);
  `);

  // Create patient
  testPatientId = runSql(`
    INSERT INTO patients (org_id, full_name, medicaid_id)
    VALUES ('${testOrgId}', 'Jane Doe', '9988776655')
    RETURNING id;
  `);

  // Create Payers
  testPayerDhsId = runSql(`
    INSERT INTO billing_payers (org_id, name, payer_type, submission_channel)
    VALUES ('${testOrgId}', 'DHS / MHCP Test', 'medicaid_direct', 'mn_its_dde')
    RETURNING id;
  `);

  testPayerConnId = runSql(`
    INSERT INTO billing_payers (org_id, name, payer_type, submission_channel)
    VALUES ('${testOrgId}', 'Connectivity of MN Test', 'broker_partner', 'email')
    RETURNING id;
  `);

  // Create operational Trip
  testTripId = runSql(`
    INSERT INTO trips (org_id, patient_id, pickup_location, dropoff_location, scheduled_time, status, distance_miles)
    VALUES ('${testOrgId}', '${testPatientId}', '100 Main St', '200 Clinic Rd', '2026-07-10 10:00:00Z', 'completed', 15.5)
    RETURNING id;
  `);
});

test.after(() => {
  // Cleanup test organization
  if (testOrgId) {
    runSql(`
      DELETE FROM billing_payment_allocations WHERE payment_id IN (SELECT id FROM billing_payments WHERE org_id = '${testOrgId}');
      DELETE FROM billing_payments WHERE org_id = '${testOrgId}';
      DELETE FROM billing_record_lines WHERE record_id IN (SELECT id FROM billing_records WHERE org_id = '${testOrgId}');
      DELETE FROM billing_submission_attempts WHERE org_id = '${testOrgId}';
      DELETE FROM billing_payer_responses WHERE org_id = '${testOrgId}';
      DELETE FROM billing_adjustments WHERE org_id = '${testOrgId}';
      DELETE FROM billing_activity_logs WHERE org_id = '${testOrgId}';
      DELETE FROM billing_records WHERE org_id = '${testOrgId}';
      DELETE FROM billing_payers WHERE org_id = '${testOrgId}';
      DELETE FROM trips WHERE org_id = '${testOrgId}';
      DELETE FROM patients WHERE org_id = '${testOrgId}';
      DELETE FROM employees WHERE org_id = '${testOrgId}';
      DELETE FROM organization_memberships WHERE org_id = '${testOrgId}';
      DELETE FROM user_profiles WHERE default_org_id = '${testOrgId}';
      DELETE FROM organizations WHERE id = '${testOrgId}';
    `);
  }
  if (testAdminId) runSql(`DELETE FROM auth.users WHERE id = '${testAdminId}';`);
  if (testDispatchId) runSql(`DELETE FROM auth.users WHERE id = '${testDispatchId}';`);
  if (testDisabledId) runSql(`DELETE FROM auth.users WHERE id = '${testDisabledId}';`);
});

// ---------------------------------------------------------
// CRITERIA 1 & 19: DHS Claim Creation with Lines & Date Separation
// ---------------------------------------------------------
test("Criteria 1 & 19: DHS Claim recorded with lines, external submission date preserved distinct from recorded_at", () => {
  const recordSql = `
    SELECT public.create_billing_record(
      jsonb_build_object(
        'org_id', '${testOrgId}',
        'record_type', 'dhs_claim',
        'payer_id', '${testPayerDhsId}',
        'client_id', '${testPatientId}',
        'internal_reference', 'CLM-TEST-0001',
        'billing_period_start', '2026-07-01',
        'billing_period_end', '2026-07-31',
        'submission_status', 'submitted',
        'external_submitted_at', '2026-07-15T10:30:00Z',
        'submission_channel', 'mn_its_dde',
        'original_external_reference', 'MN-ITS-9981'
      ),
      ARRAY[
        jsonb_build_object(
          'client_id', '${testPatientId}',
          'service_date', '2026-07-10',
          'description', 'One-Way Medical Transport',
          'hcpcs_code', 'A0130',
          'quantity', 1.00,
          'unit_type', 'one_way_trips',
          'unit_rate', 25.00,
          'billed_amount', 25.00
        )
      ]
    );
  `;

  // Set session user to admin
  const resRaw = runSql(`
    SET LOCAL ROLE postgres;
    SELECT set_config('request.jwt.claim.sub', '${testAdminId}', true);
    ${recordSql}
  `);

  const created = JSON.parse(resRaw);
  assert.equal(created.internal_reference, "CLM-TEST-0001");
  assert.equal(created.submission_status, "submitted");
  assert.equal(Number(created.total_billed_amount), 25.00);
  assert.equal(Number(created.outstanding_balance), 25.00);

  // Verify external submission attempt was created and dates are distinct
  const attemptRaw = runSql(`
    SELECT row_to_json(a) FROM public.billing_submission_attempts a WHERE record_id = '${created.id}';
  `);
  const attempt = JSON.parse(attemptRaw);
  assert.equal(attempt.attempt_number, 1);
  assert.equal(attempt.submission_channel, "mn_its_dde");
  assert.equal(Number(attempt.snapshot_billed_amount), 25.00);
  assert.ok(attempt.occurred_at.startsWith("2026-07-15"), "occurred_at preserves historical submission date");
});

// ---------------------------------------------------------
// CRITERIA 13 & 14: Duplicate Protection without Blocking Legitimate Components
// - Billed 'transport' does NOT block separate 'mileage' component on the same trip
// - Billing the same economic component to both DHS and Connectivity is REJECTED
// ---------------------------------------------------------
test("Criteria 13 & 14: Legitimate components on same trip allowed; duplicate component to another payer rejected", () => {
  // 1. Create Record A (DHS Claim) with 'transport' component on testTripId
  const recASql = runSql(`
    SELECT set_config('request.jwt.claim.sub', '${testAdminId}', true);
    SELECT public.create_billing_record(
      jsonb_build_object(
        'org_id', '${testOrgId}',
        'record_type', 'dhs_claim',
        'payer_id', '${testPayerDhsId}',
        'client_id', '${testPatientId}',
        'internal_reference', 'CLM-DUP-001',
        'billing_period_start', '2026-07-01',
        'billing_period_end', '2026-07-31',
        'submission_status', 'submitted',
        'external_submitted_at', '2026-07-12T00:00:00Z'
      ),
      ARRAY[
        jsonb_build_object(
          'client_id', '${testPatientId}',
          'service_date', '2026-07-10',
          'description', 'Base Transport',
          'trip_id', '${testTripId}',
          'trip_component', 'transport',
          'billed_amount', 30.00
        )
      ]
    );
  `);
  const recA = JSON.parse(recASql);
  assert.ok(recA.id);

  // 2. Criteria 13: Billed 'transport' does NOT block separate 'mileage' on the same trip!
  const recBSql = runSql(`
    SELECT set_config('request.jwt.claim.sub', '${testAdminId}', true);
    SELECT public.create_billing_record(
      jsonb_build_object(
        'org_id', '${testOrgId}',
        'record_type', 'dhs_claim',
        'payer_id', '${testPayerDhsId}',
        'client_id', '${testPatientId}',
        'internal_reference', 'CLM-DUP-002',
        'billing_period_start', '2026-07-01',
        'billing_period_end', '2026-07-31',
        'submission_status', 'draft'
      ),
      ARRAY[
        jsonb_build_object(
          'client_id', '${testPatientId}',
          'service_date', '2026-07-10',
          'description', 'Mileage Line',
          'trip_id', '${testTripId}',
          'trip_component', 'mileage',
          'billed_amount', 25.00
        )
      ]
    );
  `);
  const recB = JSON.parse(recBSql);
  assert.ok(recB.id, "Separate mileage component on same trip successfully recorded");

  // 3. Criteria 14: Attempt to bill Connectivity for the same 'transport' component on testTripId MUST FAIL!
  assert.throws(() => {
    runSql(`
      SELECT set_config('request.jwt.claim.sub', '${testAdminId}', true);
      SELECT public.create_billing_record(
        jsonb_build_object(
          'org_id', '${testOrgId}',
          'record_type', 'partner_invoice',
          'payer_id', '${testPayerConnId}',
          'internal_reference', 'INV-DUP-CONFLICT',
          'billing_period_start', '2026-07-01',
          'billing_period_end', '2026-07-31',
          'submission_status', 'draft'
        ),
        ARRAY[
          jsonb_build_object(
            'client_id', '${testPatientId}',
            'service_date', '2026-07-10',
            'description', 'Duplicate Transport to Connectivity',
            'trip_id', '${testTripId}',
            'trip_component', 'transport',
            'billed_amount', 30.00
          )
        ]
      );
    `);
  }, /already been recorded\/billed on active record/i);
});

// ---------------------------------------------------------
// CRITERIA 6 & 18: Rejection, Resubmission, Snapshot Freezing, No Revenue Duplication
// ---------------------------------------------------------
test("Criteria 6 & 18: Rejection, resubmission, and frozen snapshots retain history without doubling revenue", () => {
  // 1. Create Original Claim
  const origRaw = runSql(`
    SELECT set_config('request.jwt.claim.sub', '${testAdminId}', true);
    SELECT public.create_billing_record(
      jsonb_build_object(
        'org_id', '${testOrgId}',
        'record_type', 'dhs_claim',
        'payer_id', '${testPayerDhsId}',
        'client_id', '${testPatientId}',
        'internal_reference', 'CLM-RESUB-001',
        'billing_period_start', '2026-07-01',
        'billing_period_end', '2026-07-31',
        'submission_status', 'submitted',
        'external_submitted_at', '2026-07-15T00:00:00Z'
      ),
      ARRAY[
        jsonb_build_object(
          'client_id', '${testPatientId}',
          'service_date', '2026-07-05',
          'description', 'Transport Component',
          'billed_amount', 100.00
        )
      ]
    );
  `);
  const orig = JSON.parse(origRaw);

  // 2. Record Rejection
  runSql(`
    SELECT set_config('request.jwt.claim.sub', '${testAdminId}', true);
    SELECT public.record_payer_response(
      '${orig.id}',
      jsonb_build_object(
        'occurred_at', '2026-07-18T00:00:00Z',
        'response_type', 'denial',
        'adjudication_status', 'denied',
        'notes', 'Payer reported missing authorization'
      )
    );
  `);

  // 3. Resubmit with Correction
  const resubRaw = runSql(`
    SELECT set_config('request.jwt.claim.sub', '${testAdminId}', true);
    SELECT public.record_resubmission(
      '${orig.id}',
      jsonb_build_object(
        'record_type', 'dhs_claim',
        'payer_id', '${testPayerDhsId}',
        'client_id', '${testPatientId}',
        'internal_reference', 'CLM-RESUB-001-R1',
        'billing_period_start', '2026-07-01',
        'billing_period_end', '2026-07-31',
        'submission_status', 'submitted',
        'external_submitted_at', '2026-07-20T00:00:00Z'
      ),
      ARRAY[
        jsonb_build_object(
          'client_id', '${testPatientId}',
          'service_date', '2026-07-05',
          'description', 'Corrected Transport Component',
          'billed_amount', 100.00
        )
      ]
    );
  `);
  const resub = JSON.parse(resubRaw);

  // 4. Verify Original is Superseded
  const origUpdated = JSON.parse(runSql(`SELECT row_to_json(r) FROM billing_records r WHERE id = '${orig.id}';`));
  assert.equal(origUpdated.submission_status, "superseded");
  assert.equal(origUpdated.superseded_by_record_id, resub.id);

  // 5. Verify Original submission attempt snapshot is frozen at 100.00
  const attempt = JSON.parse(runSql(`
    SELECT row_to_json(a) FROM billing_submission_attempts a WHERE record_id = '${orig.id}' LIMIT 1;
  `));
  assert.equal(Number(attempt.snapshot_billed_amount), 100.00);

  // 6. Verify revenue metric ignores superseded records (does not double to 200.00)
  const activeBilled = runSql(`
    SELECT COALESCE(SUM(total_billed_amount), 0)
    FROM billing_records
    WHERE id IN ('${orig.id}', '${resub.id}')
      AND submission_status NOT IN ('draft', 'cancelled', 'superseded');
  `);
  assert.equal(Number(activeBilled), 100.00);
});

// ---------------------------------------------------------
// CRITERIA 8 & 9: Multi-Record Payment Allocation & Allocation Cap
// ---------------------------------------------------------
test("Criteria 8 & 9: $1,000 payment allocated across records counts as $1,000 total; over-allocation rejected", () => {
  // Create Record 1 ($600) and Record 2 ($400)
  const r1 = JSON.parse(runSql(`
    SELECT set_config('request.jwt.claim.sub', '${testAdminId}', true);
    SELECT public.create_billing_record(
      jsonb_build_object(
        'org_id', '${testOrgId}',
        'record_type', 'partner_invoice',
        'payer_id', '${testPayerConnId}',
        'internal_reference', 'INV-ALLOC-001',
        'billing_period_start', '2026-07-01',
        'billing_period_end', '2026-07-31',
        'submission_status', 'submitted',
        'external_submitted_at', '2026-07-05T00:00:00Z'
      ),
      ARRAY[
        jsonb_build_object(
          'client_id', '${testPatientId}',
          'service_date', '2026-07-02',
          'description', 'Service 1',
          'billed_amount', 600.00
        )
      ]
    );
  `));

  const r2 = JSON.parse(runSql(`
    SELECT set_config('request.jwt.claim.sub', '${testAdminId}', true);
    SELECT public.create_billing_record(
      jsonb_build_object(
        'org_id', '${testOrgId}',
        'record_type', 'partner_invoice',
        'payer_id', '${testPayerConnId}',
        'internal_reference', 'INV-ALLOC-002',
        'billing_period_start', '2026-07-01',
        'billing_period_end', '2026-07-31',
        'submission_status', 'submitted',
        'external_submitted_at', '2026-07-05T00:00:00Z'
      ),
      ARRAY[
        jsonb_build_object(
          'client_id', '${testPatientId}',
          'service_date', '2026-07-03',
          'description', 'Service 2',
          'billed_amount', 400.00
        )
      ]
    );
  `));

  // Over-allocation attempt: $1,200 allocated on $1,000 payment -> MUST FAIL
  assert.throws(() => {
    runSql(`
      SELECT set_config('request.jwt.claim.sub', '${testAdminId}', true);
      SELECT public.record_payment_and_allocations(
        jsonb_build_object(
          'org_id', '${testOrgId}',
          'payer_id', '${testPayerConnId}',
          'amount', 1000.00,
          'payment_method', 'eft',
          'reference_number', 'EFT-OVER-FAIL'
        ),
        ARRAY[
          jsonb_build_object('record_id', '${r1.id}', 'amount', 700.00),
          jsonb_build_object('record_id', '${r2.id}', 'amount', 500.00)
        ]
      );
    `);
  }, /cannot exceed available payment amount/i);

  // Valid allocation: $600 to r1 and $400 to r2 on $1,000 payment
  const paymentRes = JSON.parse(runSql(`
    SELECT set_config('request.jwt.claim.sub', '${testAdminId}', true);
    SELECT public.record_payment_and_allocations(
      jsonb_build_object(
        'org_id', '${testOrgId}',
        'payer_id', '${testPayerConnId}',
        'amount', 1000.00,
        'payment_method', 'eft',
        'reference_number', 'EFT-TRACE-9901',
        'received_date', '2026-07-25'
      ),
      ARRAY[
        jsonb_build_object('record_id', '${r1.id}', 'amount', 600.00),
        jsonb_build_object('record_id', '${r2.id}', 'amount', 400.00)
      ]
    );
  `));

  assert.equal(Number(paymentRes.unapplied_amount), 0.00);
  assert.equal(paymentRes.reconciliation_status, "fully_applied");

  // Check r1 is paid and balance is 0
  const r1Updated = JSON.parse(runSql(`SELECT row_to_json(r) FROM billing_records r WHERE id = '${r1.id}';`));
  assert.equal(Number(r1Updated.total_paid_amount), 600.00);
  assert.equal(Number(r1Updated.outstanding_balance), 0.00);
  assert.equal(r1Updated.settlement_status, "paid");

  // Check r2 is paid and balance is 0
  const r2Updated = JSON.parse(runSql(`SELECT row_to_json(r) FROM billing_records r WHERE id = '${r2.id}';`));
  assert.equal(Number(r2Updated.total_paid_amount), 400.00);
  assert.equal(Number(r2Updated.outstanding_balance), 0.00);
  assert.equal(r2Updated.settlement_status, "paid");

  // Cash received metric is exactly 1000.00 (from payments table, not 2000.00)
  const cashTotal = runSql(`
    SELECT COALESCE(SUM(amount), 0)
    FROM billing_payments
    WHERE id = '${paymentRes.id}' AND received_date IS NOT NULL;
  `);
  assert.equal(Number(cashTotal), 1000.00);
});

// ---------------------------------------------------------
// CRITERIA 15 & 16: Security: Cross-Tenant Rejection & Authorization
// ---------------------------------------------------------
test("Criteria 15 & 16: Unauthorized role, disabled user, and cross-tenant allocation rejected", (t) => {
  // 1. Dispatch role cannot create billing records
  assert.throws(() => {
    runSql(`
      SELECT set_config('request.jwt.claim.sub', '${testDispatchId}', true);
      SELECT public.create_billing_record(
        jsonb_build_object(
          'org_id', '${testOrgId}',
          'record_type', 'dhs_claim',
          'payer_id', '${testPayerDhsId}',
          'client_id', '${testPatientId}',
          'internal_reference', 'CLM-UNAUTH',
          'billing_period_start', '2026-07-01',
          'billing_period_end', '2026-07-31'
        ),
        ARRAY[]::jsonb[]
      );
    `);
  }, /insufficient billing permissions/i);

  // 2. Disabled user cannot mutate billing records
  assert.throws(() => {
    runSql(`
      SELECT set_config('request.jwt.claim.sub', '${testDisabledId}', true);
      SELECT public.create_billing_record(
        jsonb_build_object(
          'org_id', '${testOrgId}',
          'record_type', 'dhs_claim',
          'payer_id', '${testPayerDhsId}',
          'client_id', '${testPatientId}',
          'internal_reference', 'CLM-DISABLED',
          'billing_period_start', '2026-07-01',
          'billing_period_end', '2026-07-31'
        ),
        ARRAY[]::jsonb[]
      );
    `);
  }, /insufficient billing permissions/i);

  // 3. Cross-tenant allocation rejection
  const foreignOrgId = runSql(`
    INSERT INTO organizations (name) VALUES ('Foreign Org') RETURNING id;
  `);
  t.after(() => {
    runSql(`
      DELETE FROM billing_records WHERE org_id = '${foreignOrgId}';
      DELETE FROM billing_payers WHERE org_id = '${foreignOrgId}';
      DELETE FROM patients WHERE org_id = '${foreignOrgId}';
      DELETE FROM organizations WHERE id = '${foreignOrgId}';
    `);
  });
  const foreignPayerId = runSql(`
    INSERT INTO billing_payers (org_id, name, payer_type)
    VALUES ('${foreignOrgId}', 'Foreign test payer', 'medicaid_direct') RETURNING id;
  `);
  const foreignPatientId = runSql(`
    INSERT INTO patients (org_id, full_name)
    VALUES ('${foreignOrgId}', 'Foreign test client') RETURNING id;
  `);
  const foreignRecordId = runSql(`
    INSERT INTO billing_records (org_id, record_type, payer_id, internal_reference, client_id, billing_period_start, billing_period_end, total_billed_amount, outstanding_balance)
    VALUES ('${foreignOrgId}', 'dhs_claim', '${foreignPayerId}', 'FOREIGN-001', '${foreignPatientId}', '2026-07-01', '2026-07-31', 100.00, 100.00)
    RETURNING id;
  `);

  assert.throws(() => {
    runSql(`
      SELECT set_config('request.jwt.claim.sub', '${testAdminId}', true);
      SELECT public.record_payment_and_allocations(
        jsonb_build_object(
          'org_id', '${testOrgId}',
          'payer_id', '${testPayerDhsId}',
          'amount', 100.00,
          'payment_method', 'eft',
          'reference_number', 'EFT-CROSS-FAIL'
        ),
        ARRAY[
          jsonb_build_object('record_id', '${foreignRecordId}', 'amount', 100.00)
        ]
      );
    `);
  }, /Cross-tenant allocation rejected/i);

});
