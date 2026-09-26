import { z } from "zod";

export const billingLineSchema = z.object({
  client_id: z.string().uuid("Client is required"),
  service_date: z.string().min(1, "Service date is required"),
  description: z.string().min(1, "Description is required"),
  hcpcs_code: z.string().optional().nullable(),
  modifiers: z.array(z.string()).optional().nullable(),
  quantity: z.string().min(1, "Quantity is required").default("1.00"),
  unit_type: z.enum(["miles", "one_way_trips", "hours", "units", "flat_rate", "other"]).default("one_way_trips"),
  unit_rate: z.string().optional().nullable(),
  billed_amount: z.string().min(1, "Billed amount is required"),
  allowed_amount: z.string().optional().nullable(),
  service_agreement_id: z.string().uuid().optional().nullable(),
  service_agreement_line_id: z.string().uuid().optional().nullable(),
  trip_id: z.string().uuid().optional().nullable(),
  trip_component: z.enum(["transport", "mileage", "no_show", "wait_time", "other"]).optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const addRecordSchema = z
  .object({
    record_type: z.enum(["dhs_claim", "partner_invoice"]),
    payer_id: z.string().uuid("Payer is required"),
    internal_reference: z.string().optional(),
    client_id: z.string().uuid().optional().nullable(),
    billing_period_start: z.string().min(1, "Billing period start date is required"),
    billing_period_end: z.string().min(1, "Billing period end date is required"),
    due_date: z.string().optional().nullable(),
    submission_status: z.enum(["draft", "submitted"]).default("draft"),
    external_submitted_at: z.string().optional().nullable(),
    submitted_by_name: z.string().optional().nullable(),
    submission_channel: z
      .enum(["mn_its_dde", "partner_portal", "email", "mail", "fax", "clearinghouse", "other"])
      .optional()
      .nullable(),
    original_external_reference: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
    is_historical: z.boolean().default(false),
    is_summary_only: z.boolean().default(false),
    follow_up_owner_id: z.string().uuid().optional().nullable(),
    next_follow_up_date: z.string().optional().nullable(),
    follow_up_notes: z.string().optional().nullable(),
    lines: z.array(billingLineSchema).min(1, "At least one service line is required"),
  })
  .superRefine((data, ctx) => {
    // DHS Claim requires client_id at the record level
    if (data.record_type === "dhs_claim" && !data.client_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["client_id"],
        message: "DHS direct claims must have an assigned client",
      });
    }

    // Period validation
    if (data.billing_period_start && data.billing_period_end) {
      if (data.billing_period_start > data.billing_period_end) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["billing_period_end"],
          message: "Billing period end date cannot be earlier than start date",
        });
      }
    }

    // When recording an already-submitted record, external_submitted_at is required
    if (data.submission_status === "submitted" && (!data.external_submitted_at || data.external_submitted_at.trim() === "")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["external_submitted_at"],
        message: "Actual external submission date is required when recording an already-submitted record",
      });
    }
  });

export type AddRecordInput = z.infer<typeof addRecordSchema>;

export const recordSubmissionSchema = z.object({
  occurred_at: z.string().min(1, "Actual external submission date/time is required"),
  submission_channel: z.enum([
    "mn_its_dde",
    "partner_portal",
    "email",
    "mail",
    "fax",
    "clearinghouse",
    "other",
  ]),
  submitted_by_name: z.string().optional().nullable(),
  external_reference: z.string().optional().nullable(),
  purpose: z.enum(["original", "resubmission_correction", "replacement", "void_recorded"]).default("original"),
  notes: z.string().optional().nullable(),
});

export type RecordSubmissionInput = z.infer<typeof recordSubmissionSchema>;

export const recordResponseSchema = z.object({
  occurred_at: z.string().min(1, "Response date/time is required"),
  response_type: z.enum([
    "acknowledgement",
    "review_notice",
    "approval",
    "partial_approval",
    "denial",
    "remittance_835",
    "dispute",
    "other",
  ]),
  adjudication_status: z
    .enum(["in_review", "approved", "partially_approved", "denied"])
    .optional()
    .nullable(),
  payer_claim_number: z.string().optional().nullable(),
  category_code: z.string().optional().nullable(),
  status_code: z.string().optional().nullable(),
  adjustment_group_code: z.string().optional().nullable(),
  adjustment_reason_code: z.string().optional().nullable(),
  remark_code: z.string().optional().nullable(),
  payer_reported_amount: z.string().optional().nullable(),
  raw_description: z.string().optional().nullable(),
  evidence_doc_name: z.string().optional().nullable(),
  evidence_doc_reference: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export type RecordResponseInput = z.infer<typeof recordResponseSchema>;

export const recordPaymentSchema = z.object({
  payer_id: z.string().uuid("Payer is required"),
  amount: z
    .string()
    .min(1, "Amount is required")
    .refine((v) => Number(v) > 0, "Payment amount must be greater than zero"),
  payment_method: z.enum(["check", "eft", "ach", "credit_card", "virtual_card", "other"]),
  reference_number: z.string().min(1, "Reference number (Check # or EFT Trace #) is required"),
  payer_reported_date: z.string().optional().nullable(),
  received_date: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  allocations: z
    .array(
      z.object({
        record_id: z.string().uuid(),
        record_line_id: z.string().uuid().optional().nullable(),
        amount: z.string().min(1, "Allocation amount is required"),
        notes: z.string().optional().nullable(),
      })
    )
    .optional(),
});

export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;

export const recordAdjustmentSchema = z.object({
  adjustment_type: z.enum([
    "contractual_allowance",
    "payer_reduction",
    "discretionary_write_off",
    "copay_deductible",
    "reversal",
    "recoupment",
    "other",
  ]),
  amount: z
    .string()
    .min(1, "Adjustment amount is required")
    .refine((v) => Number(v) !== 0, "Adjustment amount cannot be zero"),
  reason: z.string().min(2, "Reason is required"),
  record_line_id: z.string().uuid().optional().nullable(),
  authorized_by: z.string().uuid().optional().nullable(),
});

export type RecordAdjustmentInput = z.infer<typeof recordAdjustmentSchema>;

export const payerConfigSchema = z.object({
  name: z.string().min(2, "Payer name is required"),
  payer_type: z.enum(["medicaid_direct", "broker_partner", "commercial", "private_pay", "other"]),
  submission_channel: z.enum([
    "mn_its_dde",
    "partner_portal",
    "email",
    "mail",
    "fax",
    "clearinghouse",
    "other",
  ]),
  contact_name: z.string().optional().nullable(),
  contact_email: z.string().email("Invalid email").optional().nullable().or(z.literal("")),
  contact_phone: z.string().optional().nullable(),
  payment_terms: z.string().optional().nullable(),
  typical_follow_up_days: z.number().int().min(0).nullable().default(null),
  is_active: z.boolean().default(true),
  notes: z.string().optional().nullable(),
});

export type PayerConfigInput = z.infer<typeof payerConfigSchema>;
