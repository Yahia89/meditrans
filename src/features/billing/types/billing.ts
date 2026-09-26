export type BillingRecordType = "dhs_claim" | "partner_invoice";

export type SubmissionStatus =
  | "draft"
  | "submitted"
  | "received"
  | "rejected"
  | "cancelled"
  | "superseded";

export type AdjudicationStatus =
  | "not_reported"
  | "in_review"
  | "approved"
  | "partially_approved"
  | "denied";

export type SettlementStatus =
  | "unpaid"
  | "payment_scheduled"
  | "partially_paid"
  | "paid"
  | "overpaid";

export type SubmissionChannel =
  | "mn_its_dde"
  | "partner_portal"
  | "email"
  | "mail"
  | "fax"
  | "clearinghouse"
  | "other";

export type UnitType =
  | "miles"
  | "one_way_trips"
  | "hours"
  | "units"
  | "flat_rate"
  | "other";

export type PaymentMethod =
  | "check"
  | "eft"
  | "ach"
  | "credit_card"
  | "virtual_card"
  | "other";

export type AdjustmentType =
  | "contractual_allowance"
  | "payer_reduction"
  | "discretionary_write_off"
  | "copay_deductible"
  | "reversal"
  | "recoupment"
  | "other";

export type PayerType =
  | "medicaid_direct"
  | "broker_partner"
  | "commercial"
  | "private_pay"
  | "other";

export type TripComponent =
  | "transport"
  | "mileage"
  | "no_show"
  | "wait_time"
  | "other";

export interface BillingPayer {
  id: string;
  org_id: string;
  name: string;
  payer_type: PayerType;
  submission_channel: SubmissionChannel;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  payment_terms: string | null;
  typical_follow_up_days: number | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface BillingRecordBase {
  id: string;
  org_id: string;
  record_type: BillingRecordType;
  payer_id: string;
  internal_reference: string;
  billing_period_start: string;
  billing_period_end: string;
  due_date: string | null;
  original_external_reference: string | null;
  current_submission_attempt: number;
  external_submitted_at: string | null;
  submitted_by_name: string | null;
  submission_channel: SubmissionChannel | null;
  payer_acknowledged_at: string | null;
  follow_up_owner_id: string | null;
  next_follow_up_date: string | null;
  follow_up_notes: string | null;

  submission_status: SubmissionStatus;
  adjudication_status: AdjudicationStatus;
  settlement_status: SettlementStatus;

  total_billed_amount: string;
  total_allowed_amount: string | null;
  total_paid_amount: string;
  total_adjusted_amount: string;
  outstanding_balance: string;

  version: number;
  is_historical: boolean;
  is_summary_only: boolean;
  provenance: "manual_entry" | "historical_backfill" | "legacy_import";
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  superseded_by_record_id: string | null;
  replaces_record_id: string | null;

  // Joined relations
  payer?: BillingPayer | null;
  client?: {
    id: string;
    full_name: string;
    medicaid_id: string | null;
  } | null;
  lines?: BillingRecordLine[];
}

export interface DhsClaimRecord extends BillingRecordBase {
  record_type: "dhs_claim";
  client_id: string; // Non-nullable for DHS claim
}

export interface PartnerInvoiceRecord extends BillingRecordBase {
  record_type: "partner_invoice";
  client_id: string | null; // Nullable if invoice aggregates multiple clients
}

export type BillingRecord = DhsClaimRecord | PartnerInvoiceRecord;

export interface BillingRecordLine {
  id: string;
  record_id: string;
  org_id: string;
  client_id: string;
  service_date: string;
  description: string;
  hcpcs_code: string | null;
  modifiers: string[] | null;
  quantity: string;
  unit_type: UnitType;
  unit_rate: string | null;
  billed_amount: string;
  allowed_amount: string | null;
  adjusted_amount: string;
  paid_amount: string;
  line_status: string;
  service_agreement_id: string | null;
  service_agreement_line_id: string | null;
  trip_id: string | null;
  trip_component: TripComponent | null;
  denial_reason: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;

  client?: {
    id: string;
    full_name: string;
    medicaid_id: string | null;
  } | null;
}

export interface BillingSubmissionAttempt {
  id: string;
  record_id: string;
  org_id: string;
  attempt_number: number;
  purpose: "original" | "resubmission_correction" | "replacement" | "void_recorded";
  occurred_at: string;
  recorded_at: string;
  recorded_by: string | null;
  submitted_by_name: string | null;
  submission_channel: SubmissionChannel;
  external_reference: string | null;
  snapshot_billed_amount: string;
  notes: string | null;
}

export interface BillingPayerResponse {
  id: string;
  record_id: string;
  submission_attempt_id: string | null;
  org_id: string;
  response_type:
    | "acknowledgement"
    | "review_notice"
    | "approval"
    | "partial_approval"
    | "denial"
    | "remittance_835"
    | "dispute"
    | "other";
  adjudication_status: AdjudicationStatus | null;
  occurred_at: string;
  recorded_at: string;
  recorded_by: string | null;
  payer_claim_number: string | null;
  category_code: string | null;
  status_code: string | null;
  adjustment_group_code: string | null;
  adjustment_reason_code: string | null;
  remark_code: string | null;
  payer_reported_amount: string | null;
  raw_description: string | null;
  evidence_doc_name: string | null;
  evidence_doc_reference: string | null;
  notes: string | null;
}

export interface BillingPayment {
  id: string;
  org_id: string;
  payer_id: string;
  amount: string;
  currency: string;
  payment_method: PaymentMethod;
  reference_number: string;
  payer_reported_date: string | null;
  received_date: string | null;
  reconciliation_status: "unapplied" | "partially_applied" | "fully_applied" | "reconciled";
  unapplied_amount: string;
  notes: string | null;
  created_at: string;
  created_by: string | null;
  reconciled_at: string | null;
  reconciled_by: string | null;

  payer?: BillingPayer | null;
  allocations?: BillingPaymentAllocation[];
}

export interface BillingPaymentAllocation {
  id: string;
  payment_id: string;
  record_id: string;
  record_line_id: string | null;
  org_id: string;
  amount: string;
  allocated_at: string;
  allocated_by: string | null;
  notes: string | null;

  payment?: BillingPayment | null;
  record?: {
    id: string;
    internal_reference: string;
    record_type: BillingRecordType;
    total_billed_amount: string;
    outstanding_balance: string;
  } | null;
}

export interface BillingAdjustment {
  id: string;
  record_id: string;
  record_line_id: string | null;
  org_id: string;
  adjustment_type: AdjustmentType;
  amount: string;
  reason: string;
  authorized_by: string | null;
  created_at: string;
  created_by: string | null;
}

export interface BillingActivityLog {
  id: string;
  record_id: string;
  org_id: string;
  event_type: string;
  occurred_at: string;
  recorded_at: string;
  actor_id: string | null;
  actor_name: string | null;
  payload: Record<string, unknown> | null;
  notes: string | null;
}

export interface BillingDocument {
  id: string;
  org_id: string;
  record_id: string | null;
  payment_id: string | null;
  storage_path: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  document_type:
    | "claim_copy"
    | "invoice_copy"
    | "submission_receipt"
    | "payer_notice"
    | "remittance_advice"
    | "service_agreement"
    | "trip_summary"
    | "other";
  uploaded_at: string;
  uploaded_by: string | null;
  notes: string | null;
}
