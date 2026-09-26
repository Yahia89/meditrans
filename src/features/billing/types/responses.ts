import { z } from "zod";
import {
  billingLineSchema,
  payerConfigSchema,
  recordAdjustmentSchema,
  recordPaymentSchema,
  recordResponseSchema,
  recordSubmissionSchema,
} from "./schemas.ts";

// PostgREST serializes PostgreSQL numeric columns as JSON numbers. Normalize at
// the API boundary so domain consumers consistently receive decimal strings.
export const decimalResponseSchema = z
  .union([z.number(), z.string().regex(/^-?\d+(?:\.\d+)?$/)])
  .transform(String);

const nullableText = z.string().nullable();
const recordType = z.enum(["dhs_claim", "partner_invoice"]);
const client = z.object({
  id: z.string(),
  full_name: z.string(),
  medicaid_id: nullableText,
});
const submissionStatus = z.enum([
  "draft", "submitted", "received", "rejected", "cancelled", "superseded",
]);
const adjudicationStatus = z.enum([
  "not_reported", "in_review", "approved", "partially_approved", "denied",
]);
const settlementStatus = z.enum([
  "unpaid", "payment_scheduled", "partially_paid", "paid", "overpaid",
]);

export const billingPayerResponseSchema = z.object({
  id: z.string(),
  org_id: z.string(),
  name: z.string(),
  payer_type: payerConfigSchema.shape.payer_type,
  submission_channel: payerConfigSchema.shape.submission_channel,
  contact_name: nullableText,
  contact_email: nullableText,
  contact_phone: nullableText,
  payment_terms: nullableText,
  typical_follow_up_days: z.number().int().nullable(),
  is_active: z.boolean(),
  notes: nullableText,
  created_at: z.string(),
  updated_at: z.string(),
  created_by: nullableText,
});

export const billingLineResponseSchema = z.object({
  id: z.string(),
  record_id: z.string(),
  org_id: z.string(),
  client_id: z.string(),
  service_date: z.string(),
  description: z.string(),
  hcpcs_code: nullableText,
  modifiers: z.array(z.string()).nullable(),
  quantity: decimalResponseSchema,
  unit_type: billingLineSchema.shape.unit_type.removeDefault(),
  unit_rate: decimalResponseSchema.nullable(),
  billed_amount: decimalResponseSchema,
  allowed_amount: decimalResponseSchema.nullable(),
  adjusted_amount: decimalResponseSchema,
  paid_amount: decimalResponseSchema,
  line_status: z.string(),
  service_agreement_id: nullableText,
  service_agreement_line_id: nullableText,
  trip_id: nullableText,
  trip_component: billingLineSchema.shape.trip_component.nonoptional(),
  denial_reason: nullableText,
  notes: nullableText,
  created_at: z.string(),
  updated_at: z.string(),
  client: client.nullable().optional(),
});

const billingRecordBaseResponseSchema = z.object({
  id: z.string(),
  org_id: z.string(),
  payer_id: z.string(),
  internal_reference: z.string(),
  billing_period_start: z.string(),
  billing_period_end: z.string(),
  due_date: nullableText,
  original_external_reference: nullableText,
  current_submission_attempt: z.number().int(),
  external_submitted_at: nullableText,
  submitted_by_name: nullableText,
  submission_channel: payerConfigSchema.shape.submission_channel.nullable(),
  payer_acknowledged_at: nullableText,
  follow_up_owner_id: nullableText,
  next_follow_up_date: nullableText,
  follow_up_notes: nullableText,
  submission_status: submissionStatus,
  adjudication_status: adjudicationStatus,
  settlement_status: settlementStatus,
  total_billed_amount: decimalResponseSchema,
  total_allowed_amount: decimalResponseSchema.nullable(),
  total_paid_amount: decimalResponseSchema,
  total_adjusted_amount: decimalResponseSchema,
  outstanding_balance: decimalResponseSchema,
  version: z.number().int(),
  is_historical: z.boolean(),
  is_summary_only: z.boolean(),
  provenance: z.enum(["manual_entry", "historical_backfill", "legacy_import"]),
  notes: nullableText,
  created_at: z.string(),
  updated_at: z.string(),
  created_by: nullableText,
  updated_by: nullableText,
  superseded_by_record_id: nullableText,
  replaces_record_id: nullableText,
  payer: billingPayerResponseSchema.nullable().optional(),
  client: client.nullable().optional(),
  lines: z.array(billingLineResponseSchema).optional(),
});

export const billingRecordResponseSchema = z.discriminatedUnion("record_type", [
  billingRecordBaseResponseSchema.extend({
    record_type: z.literal("dhs_claim"),
    client_id: z.string(),
  }),
  billingRecordBaseResponseSchema.extend({
    record_type: z.literal("partner_invoice"),
    client_id: nullableText,
  }),
]);

export const billingSubmissionResponseSchema = z.object({
  id: z.string(),
  record_id: z.string(),
  org_id: z.string(),
  attempt_number: z.number().int(),
  purpose: recordSubmissionSchema.shape.purpose.removeDefault(),
  occurred_at: z.string(),
  recorded_at: z.string(),
  recorded_by: nullableText,
  submitted_by_name: nullableText,
  submission_channel: payerConfigSchema.shape.submission_channel,
  external_reference: nullableText,
  snapshot_billed_amount: decimalResponseSchema,
  notes: nullableText,
});

export const billingResponseResponseSchema = z.object({
  id: z.string(),
  record_id: z.string(),
  submission_attempt_id: nullableText,
  org_id: z.string(),
  response_type: recordResponseSchema.shape.response_type,
  adjudication_status: adjudicationStatus.nullable(),
  occurred_at: z.string(),
  recorded_at: z.string(),
  recorded_by: nullableText,
  payer_claim_number: nullableText,
  category_code: nullableText,
  status_code: nullableText,
  adjustment_group_code: nullableText,
  adjustment_reason_code: nullableText,
  remark_code: nullableText,
  payer_reported_amount: decimalResponseSchema.nullable(),
  raw_description: nullableText,
  evidence_doc_name: nullableText,
  evidence_doc_reference: nullableText,
  notes: nullableText,
});

const billingPaymentBaseResponseSchema = z.object({
  id: z.string(),
  org_id: z.string(),
  payer_id: z.string(),
  amount: decimalResponseSchema,
  currency: z.string(),
  payment_method: recordPaymentSchema.shape.payment_method,
  reference_number: z.string(),
  payer_reported_date: nullableText,
  received_date: nullableText,
  reconciliation_status: z.enum([
    "unapplied", "partially_applied", "fully_applied", "reconciled",
  ]),
  unapplied_amount: decimalResponseSchema,
  notes: nullableText,
  created_at: z.string(),
  created_by: nullableText,
  reconciled_at: nullableText,
  reconciled_by: nullableText,
  payer: billingPayerResponseSchema.nullable().optional(),
});

export const billingAllocationResponseSchema = z.object({
  id: z.string(),
  payment_id: z.string(),
  record_id: z.string(),
  record_line_id: nullableText,
  org_id: z.string(),
  amount: decimalResponseSchema,
  allocated_at: z.string(),
  allocated_by: nullableText,
  notes: nullableText,
  payment: billingPaymentBaseResponseSchema.nullable().optional(),
  record: z.object({
    id: z.string(),
    internal_reference: z.string(),
    record_type: recordType,
    total_billed_amount: decimalResponseSchema,
    outstanding_balance: decimalResponseSchema,
  }).nullable().optional(),
});

export const billingPaymentResponseSchema = billingPaymentBaseResponseSchema.extend({
  allocations: z.array(billingAllocationResponseSchema).optional(),
});

export const billingAdjustmentResponseSchema = z.object({
  id: z.string(),
  record_id: z.string(),
  record_line_id: nullableText,
  org_id: z.string(),
  adjustment_type: recordAdjustmentSchema.shape.adjustment_type,
  amount: decimalResponseSchema,
  reason: z.string(),
  authorized_by: nullableText,
  created_at: z.string(),
  created_by: nullableText,
});

export const billingActivityResponseSchema = z.object({
  id: z.string(),
  record_id: z.string(),
  org_id: z.string(),
  event_type: z.string(),
  occurred_at: z.string(),
  recorded_at: z.string(),
  actor_id: nullableText,
  actor_name: nullableText,
  payload: z.record(z.string(), z.unknown()).nullable(),
  notes: nullableText,
});

export const billingDocumentResponseSchema = z.object({
  id: z.string(),
  org_id: z.string(),
  record_id: nullableText,
  payment_id: nullableText,
  storage_path: z.string(),
  file_name: z.string(),
  file_size: z.number().int(),
  mime_type: z.string(),
  document_type: z.enum([
    "claim_copy", "invoice_copy", "submission_receipt", "payer_notice",
    "remittance_advice", "service_agreement", "trip_summary", "other",
  ]),
  uploaded_at: z.string(),
  uploaded_by: nullableText,
  notes: nullableText,
});

export const billingAllocationRecordResponseSchema = z.object({
  id: z.string(),
  internal_reference: z.string(),
  payer_id: z.string(),
  outstanding_balance: decimalResponseSchema,
  client: z.object({ full_name: z.string() }).nullable(),
});

export type BillingAllocationRecord = z.infer<typeof billingAllocationRecordResponseSchema>;
