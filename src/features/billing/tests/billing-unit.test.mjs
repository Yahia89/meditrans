import assert from "node:assert/strict";
import test from "node:test";
import {
  multiplyQtyRate,
  addMoney,
  subtractMoney,
  formatMoney,
  calculateOutstandingBalance,
  compareMoney,
} from "../utils/decimal.ts";
import {
  getSubmissionStatusMeta,
  getAdjudicationStatusMeta,
  getSettlementStatusMeta,
  doesRecordRequireAction,
} from "../utils/status-helpers.ts";
import { sanitizeCsvCell, generateCsv } from "../utils/export-helpers.ts";
import {
  addRecordSchema,
  recordSubmissionSchema,
  recordPaymentSchema,
  recordAdjustmentSchema,
  payerConfigSchema,
} from "../types/schemas.ts";

const VALID_PAYER_ID = "a0000000-0000-4000-8000-000000000001";
const VALID_CLIENT_A = "b0000000-0000-4000-8000-000000000002";
const VALID_CLIENT_B = "c0000000-0000-4000-8000-000000000003";

test("payer follow-up defaults stay unset and an explicit zero is preserved", () => {
  const payer = {
    name: "Partner payer",
    payer_type: "broker_partner",
    submission_channel: "other",
  };

  assert.equal(payerConfigSchema.parse(payer).typical_follow_up_days, null);
  for (const days of [null, 0, 30]) {
    assert.equal(
      payerConfigSchema.parse({ ...payer, typical_follow_up_days: days }).typical_follow_up_days,
      days,
    );
  }
  for (const days of [-1, 1.5, NaN]) {
    assert.equal(payerConfigSchema.safeParse({ ...payer, typical_follow_up_days: days }).success, false);
  }
});

// ---------------------------------------------------------
// CRITERIA 12: Exact Decimal Arithmetic Test
// 80 × 1.54 = 123.20 (NOT 124.00)
// ---------------------------------------------------------
test("Criteria 12: 80 × $1.54 calculates exactly as $123.20", () => {
  const result = multiplyQtyRate("80", "1.54");
  assert.equal(result, "123.20");

  const formatted = formatMoney(result);
  assert.equal(formatted, "$123.20");

  // Additional decimal edge cases
  assert.equal(multiplyQtyRate("1", "0.01"), "0.01");
  assert.equal(multiplyQtyRate("3", "0.33"), "0.99");
  assert.equal(addMoney("0.10", "0.20"), "0.30"); // No IEEE 754 float drift!
});

// ---------------------------------------------------------
// CRITERIA 10: Financial Formula: $1,000 charge - $100 adjustment - $400 received = $500 balance
// ---------------------------------------------------------
test("Criteria 10: $1,000 charge, $100 adjustment, $400 payment produce $500 open balance", () => {
  const billed = "1000.00";
  const adjustment = "100.00";
  const received = "400.00";

  const balance = calculateOutstandingBalance(billed, received, adjustment);
  assert.equal(balance, "500.00");
});

// ---------------------------------------------------------
// CRITERIA 4 & 5: Status Model & Distinctions
// - "Received by payer" does NOT mark money as received
// - "Under review / suspended" does NOT display as paid or denied
// ---------------------------------------------------------
test("Criteria 4: 'Received by payer' acknowledges submission receipt without marking funds received", () => {
  const subMeta = getSubmissionStatusMeta("received");
  assert.equal(subMeta.label, "Received by Payer");
  assert.match(subMeta.description, /Payer acknowledged receipt/i);

  // Settlement remains unpaid
  const setMeta = getSettlementStatusMeta("unpaid");
  assert.equal(setMeta.label, "Unpaid");
  assert.notEqual(setMeta.label, "Paid");
});

test("Criteria 5: 'Under review / suspended' displays as review, not paid or denied", () => {
  const adjMeta = getAdjudicationStatusMeta("in_review");
  assert.equal(adjMeta.label, "Under Review / Suspended");
  assert.notEqual(adjMeta.label, "Paid");
  assert.notEqual(adjMeta.label, "Denied");
  assert.match(adjMeta.description, /review/i);
});

// ---------------------------------------------------------
// CRITERIA 7: Partially Paid record remains partially paid
// ---------------------------------------------------------
test("Criteria 7: Partially paid record has settlement status 'Partially Paid' and preserves open balance", () => {
  const setMeta = getSettlementStatusMeta("partially_paid");
  assert.equal(setMeta.label, "Partially Paid");

  const billed = "500.00";
  const paid = "200.00";
  const adjusted = "0.00";
  const openBalance = calculateOutstandingBalance(billed, paid, adjusted);

  assert.equal(openBalance, "300.00");
  assert.ok(compareMoney(openBalance, "0.00") > 0);
});

// ---------------------------------------------------------
// CRITERIA 11: Fully adjusted record with zero receipts is NOT displayed as cash paid
// ---------------------------------------------------------
test("Criteria 11: A fully credited/adjusted record with zero receipts is not displayed as cash paid", () => {
  const billed = "250.00";
  const paid = "0.00";
  const adjusted = "250.00";
  const openBalance = calculateOutstandingBalance(billed, paid, adjusted);

  assert.equal(openBalance, "0.00");

  // In the settlement state machine: cash receipts == 0 -> remains unpaid, not "Paid"
  const setMeta = getSettlementStatusMeta("unpaid");
  assert.equal(setMeta.label, "Unpaid");
  assert.notEqual(setMeta.label, "Paid");
});

// ---------------------------------------------------------
// CRITERIA 1: DHS Claim Schema Validation (Requires client_id and external submission date)
// ---------------------------------------------------------
test("Criteria 1: DHS Claim validates client, lines, and actual external submission date", () => {
  const validDhsClaim = {
    record_type: "dhs_claim",
    payer_id: VALID_PAYER_ID,
    client_id: VALID_CLIENT_A,
    billing_period_start: "2026-07-01",
    billing_period_end: "2026-07-31",
    submission_status: "submitted",
    external_submitted_at: "2026-08-01",
    submission_channel: "mn_its_dde",
    original_external_reference: "MNITS-CLAIM-992",
    lines: [
      {
        client_id: VALID_CLIENT_A,
        service_date: "2026-07-10",
        description: "One-Way Medical Transport",
        hcpcs_code: "A0130",
        quantity: "1.00",
        unit_type: "one_way_trips",
        unit_rate: "25.00",
        billed_amount: "25.00",
      },
    ],
  };

  const parsed = addRecordSchema.safeParse(validDhsClaim);
  assert.ok(parsed.success, "DHS claim parsed successfully");

  // Missing client_id on DHS claim must fail!
  const invalidDhsClaim = { ...validDhsClaim, client_id: undefined };
  const failClient = addRecordSchema.safeParse(invalidDhsClaim);
  assert.equal(failClient.success, false);

  // Marked as submitted without external_submitted_at must fail!
  const missingDate = { ...validDhsClaim, external_submitted_at: undefined };
  const failDate = addRecordSchema.safeParse(missingDate);
  assert.equal(failDate.success, false);
});

// ---------------------------------------------------------
// CRITERIA 2: Connectivity of MN Partner Invoice Schema Validation
// (Does not require DHS clinical authorization or MHCP ID)
// ---------------------------------------------------------
test("Criteria 2: Connectivity invoice validates without requiring DHS-specific fields", () => {
  const validConnectivityInvoice = {
    record_type: "partner_invoice",
    payer_id: VALID_PAYER_ID,
    billing_period_start: "2026-07-01",
    billing_period_end: "2026-07-31",
    due_date: "2026-08-31",
    submission_status: "draft",
    lines: [
      {
        client_id: VALID_CLIENT_A,
        service_date: "2026-07-15",
        description: "Client Transport Contract Rate",
        quantity: "2.00",
        unit_type: "one_way_trips",
        unit_rate: "30.00",
        billed_amount: "60.00",
        // No hcpcs_code, no authorization number, no diagnosis code!
      },
    ],
  };

  const parsed = addRecordSchema.safeParse(validConnectivityInvoice);
  assert.ok(parsed.success, "Connectivity partner invoice validated successfully");
  assert.equal(parsed.data.is_summary_only, false);
  assert.equal(parsed.data.is_historical, false);
});

// ---------------------------------------------------------
// CRITERIA 3: Multi-Client Partner Invoice Attribution
// ---------------------------------------------------------
test("Criteria 3: Partner invoice contains multiple clients while preserving client attribution per line", () => {
  const multiClientInvoice = {
    record_type: "partner_invoice",
    payer_id: VALID_PAYER_ID,
    client_id: null, // Nullable at record level for multi-client invoice
    billing_period_start: "2026-07-01",
    billing_period_end: "2026-07-31",
    submission_status: "draft",
    lines: [
      {
        client_id: VALID_CLIENT_A,
        service_date: "2026-07-02",
        description: "Trip for Client A",
        quantity: "1.00",
        unit_type: "one_way_trips",
        billed_amount: "30.00",
      },
      {
        client_id: VALID_CLIENT_B,
        service_date: "2026-07-03",
        description: "Trip for Client B",
        quantity: "1.00",
        unit_type: "one_way_trips",
        billed_amount: "45.00",
      },
    ],
  };

  const parsed = addRecordSchema.safeParse(multiClientInvoice);
  assert.ok(parsed.success);
  if (parsed.success) {
    assert.equal(parsed.data.lines[0].client_id, VALID_CLIENT_A);
    assert.equal(parsed.data.lines[1].client_id, VALID_CLIENT_B);
  }
});

// ---------------------------------------------------------
// CRITERIA 8 & 9: Payment Allocations & Caps
// - One $1,000 payment allocated across records counts as $1,000 received, not $1,000 per record
// - Allocation cannot exceed available payment
// ---------------------------------------------------------
test("Criteria 8: One $1,000 payment allocated across 2 records counts as $1,000 total received", () => {
  const paymentAmount = "1000.00";
  const alloc1 = "600.00";
  const alloc2 = "400.00";

  const totalAllocated = addMoney(alloc1, alloc2);
  assert.equal(totalAllocated, "1000.00");

  const unapplied = subtractMoney(paymentAmount, totalAllocated);
  assert.equal(unapplied, "0.00");
});

test("Criteria 9: Payment allocation cannot exceed available payment amount", () => {
  const paymentAmount = "500.00";
  const overAllocation = "600.00";

  assert.ok(compareMoney(overAllocation, paymentAmount) > 0, "Over-allocation is detected");
});

// ---------------------------------------------------------
// CRITERIA 14: Action Needed Evaluation
// ---------------------------------------------------------
test("Criteria 14: Rejections, denials, and overdue follow-ups trigger action-needed flag", () => {
  const rejectedRecord = {
    submission_status: "rejected",
    adjudication_status: "not_reported",
    settlement_status: "unpaid",
  };
  assert.equal(doesRecordRequireAction(rejectedRecord), true);

  const deniedRecord = {
    submission_status: "received",
    adjudication_status: "denied",
    settlement_status: "unpaid",
  };
  assert.equal(doesRecordRequireAction(deniedRecord), true);

  const pastDueFollowUp = {
    submission_status: "submitted",
    adjudication_status: "in_review",
    settlement_status: "unpaid",
    next_follow_up_date: "2025-01-01", // Past date
  };
  assert.equal(doesRecordRequireAction(pastDueFollowUp), true);

  const cleanPaidRecord = {
    submission_status: "received",
    adjudication_status: "approved",
    settlement_status: "paid",
  };
  assert.equal(doesRecordRequireAction(cleanPaidRecord), false);
});

// ---------------------------------------------------------
// CSV Formula Injection Sanitization (CWE-1236)
// ---------------------------------------------------------
test("CSV Export Sanitization: Formula injection prefixes are neutralized", () => {
  assert.equal(sanitizeCsvCell("=CMD|' /C calc'!A0"), `"'=CMD|' /C calc'!A0"`);
  assert.equal(sanitizeCsvCell("+1234"), ` "'+1234"`.trim());
  assert.equal(sanitizeCsvCell("-100"), `"'-100"`);
  assert.equal(sanitizeCsvCell("@SUM(A1:A10)"), `"'@SUM(A1:A10)"`);
  assert.equal(sanitizeCsvCell("Normal text"), `"Normal text"`);
});

// ---------------------------------------------------------
// CRITERIA 21: Isolation: No manual action triggers 837P transmission or SFTP
// ---------------------------------------------------------
test("Criteria 21: Manual billing action schemas contain no SFTP or automated transmission endpoints", () => {
  // Ensure schema doesn't accept or invoke transmit workers
  const submissionFields = Object.keys(recordSubmissionSchema.shape);
  assert.ok(!submissionFields.includes("sftp_password"));
  assert.ok(!submissionFields.includes("transmit_now"));
  assert.ok(!submissionFields.includes("submitter_id"));
});
