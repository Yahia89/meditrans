import { billingDb } from "./client";
import type {
  BillingRecord,
  BillingRecordType,
  SubmissionStatus,
  AdjudicationStatus,
  SettlementStatus,
  BillingRecordLine,
  BillingSubmissionAttempt,
  BillingPayerResponse,
  BillingPaymentAllocation,
  BillingAdjustment,
  BillingActivityLog,
  BillingDocument,
} from "../types/billing";
import {
  billingRecordResponseSchema,
  billingLineResponseSchema,
  billingSubmissionResponseSchema,
  billingResponseResponseSchema,
  billingAllocationResponseSchema,
  billingAdjustmentResponseSchema,
  billingActivityResponseSchema,
  billingDocumentResponseSchema,
  billingAllocationRecordResponseSchema,
  type BillingAllocationRecord,
} from "../types/responses";
import { doesRecordRequireAction } from "../utils/status-helpers";
import type { AddRecordInput, RecordSubmissionInput, RecordResponseInput } from "../types/schemas";

export interface BillingRecordFilterParams {
  orgId: string;
  payerId?: string;
  clientId?: string;
  recordType?: BillingRecordType | "all";
  submissionStatus?: SubmissionStatus | "all";
  adjudicationStatus?: AdjudicationStatus | "all";
  settlementStatus?: SettlementStatus | "all";
  periodStart?: string;
  periodEnd?: string;
  search?: string;
  actionNeededOnly?: boolean;
}

export async function getBillingRecords(
  filters: BillingRecordFilterParams
): Promise<BillingRecord[]> {
  let query = billingDb
    .from("billing_records")
    .select(
      `
      *,
      payer:billing_payers(*),
      client:patients(id, full_name, medicaid_id),
      lines:billing_record_lines(*)
    `
    )
    .eq("org_id", filters.orgId)
    .order("created_at", { ascending: false });

  if (filters.payerId && filters.payerId !== "all") {
    query = query.eq("payer_id", filters.payerId);
  }
  if (filters.clientId && filters.clientId !== "all") {
    query = query.eq("client_id", filters.clientId);
  }
  if (filters.recordType && filters.recordType !== "all") {
    query = query.eq("record_type", filters.recordType);
  }
  if (filters.submissionStatus && filters.submissionStatus !== "all") {
    query = query.eq("submission_status", filters.submissionStatus);
  }
  if (filters.adjudicationStatus && filters.adjudicationStatus !== "all") {
    query = query.eq("adjudication_status", filters.adjudicationStatus);
  }
  if (filters.settlementStatus && filters.settlementStatus !== "all") {
    query = query.eq("settlement_status", filters.settlementStatus);
  }
  if (filters.periodStart) {
    query = query.gte("billing_period_start", filters.periodStart);
  }
  if (filters.periodEnd) {
    query = query.lte("billing_period_end", filters.periodEnd);
  }
  if (filters.search && filters.search.trim() !== "") {
    const s = filters.search.trim();
    query = query.or(
      `internal_reference.ilike.%${s}%,original_external_reference.ilike.%${s}%,notes.ilike.%${s}%`
    );
  }

  const { data, error } = await query;
  if (error) {
    console.error("Error fetching billing records:", error);
    throw error;
  }

  let records = billingRecordResponseSchema.array().parse(data ?? []);

  if (filters.actionNeededOnly) {
    records = records.filter((record) => doesRecordRequireAction(record));
  }

  return records;
}

export interface FullBillingRecordDetails {
  record: BillingRecord;
  lines: BillingRecordLine[];
  submissionAttempts: BillingSubmissionAttempt[];
  payerResponses: BillingPayerResponse[];
  allocations: BillingPaymentAllocation[];
  adjustments: BillingAdjustment[];
  activityLogs: BillingActivityLog[];
  documents: BillingDocument[];
}

export async function getBillingRecordById(recordId: string): Promise<FullBillingRecordDetails> {
  const [
    recordRes,
    linesRes,
    attemptsRes,
    responsesRes,
    allocationsRes,
    adjustmentsRes,
    activityRes,
    docsRes,
  ] = await Promise.all([
    billingDb
      .from("billing_records")
      .select(
        `
        *,
        payer:billing_payers(*),
        client:patients(id, full_name, medicaid_id)
      `
      )
      .eq("id", recordId)
      .single(),

    billingDb
      .from("billing_record_lines")
      .select(
        `
        *,
        client:patients(id, full_name, medicaid_id)
      `
      )
      .eq("record_id", recordId)
      .order("service_date", { ascending: true }),

    billingDb
      .from("billing_submission_attempts")
      .select("*")
      .eq("record_id", recordId)
      .order("attempt_number", { ascending: false }),

    billingDb
      .from("billing_payer_responses")
      .select("*")
      .eq("record_id", recordId)
      .order("occurred_at", { ascending: false }),

    billingDb
      .from("billing_payment_allocations")
      .select(
        `
        *,
        payment:billing_payments(*)
      `
      )
      .eq("record_id", recordId)
      .order("allocated_at", { ascending: false }),

    billingDb
      .from("billing_adjustments")
      .select("*")
      .eq("record_id", recordId)
      .order("created_at", { ascending: false }),

    billingDb
      .from("billing_activity_logs")
      .select("*")
      .eq("record_id", recordId)
      .order("occurred_at", { ascending: false }),

    billingDb
      .from("billing_documents")
      .select("*")
      .eq("record_id", recordId)
      .order("uploaded_at", { ascending: false }),
  ]);

  for (const result of [recordRes, linesRes, attemptsRes, responsesRes, allocationsRes, adjustmentsRes, activityRes, docsRes]) {
    if (result.error) throw result.error;
  }

  return {
    record: billingRecordResponseSchema.parse(recordRes.data),
    lines: billingLineResponseSchema.array().parse(linesRes.data ?? []),
    submissionAttempts: billingSubmissionResponseSchema.array().parse(attemptsRes.data ?? []),
    payerResponses: billingResponseResponseSchema.array().parse(responsesRes.data ?? []),
    allocations: billingAllocationResponseSchema.array().parse(allocationsRes.data ?? []),
    adjustments: billingAdjustmentResponseSchema.array().parse(adjustmentsRes.data ?? []),
    activityLogs: billingActivityResponseSchema.array().parse(activityRes.data ?? []),
    documents: billingDocumentResponseSchema.array().parse(docsRes.data ?? []),
  };
}

export async function createBillingRecord(
  orgId: string,
  input: AddRecordInput
): Promise<BillingRecord> {
  const payload = {
    org_id: orgId,
    record_type: input.record_type,
    payer_id: input.payer_id,
    internal_reference: input.internal_reference,
    client_id: input.client_id,
    billing_period_start: input.billing_period_start,
    billing_period_end: input.billing_period_end,
    due_date: input.due_date,
    submission_status: input.submission_status,
    external_submitted_at: input.external_submitted_at,
    submitted_by_name: input.submitted_by_name,
    submission_channel: input.submission_channel,
    original_external_reference: input.original_external_reference,
    notes: input.notes,
    is_historical: input.is_historical,
    is_summary_only: input.is_summary_only,
    follow_up_owner_id: input.follow_up_owner_id,
    next_follow_up_date: input.next_follow_up_date,
    follow_up_notes: input.follow_up_notes,
  };

  const linesPayload = input.lines.map((l) => ({
    client_id: l.client_id,
    service_date: l.service_date,
    description: l.description,
    hcpcs_code: l.hcpcs_code || null,
    modifiers: l.modifiers || null,
    quantity: l.quantity,
    unit_type: l.unit_type,
    unit_rate: l.unit_rate || null,
    billed_amount: l.billed_amount,
    allowed_amount: l.allowed_amount || null,
    service_agreement_id: l.service_agreement_id || null,
    service_agreement_line_id: l.service_agreement_line_id || null,
    trip_id: l.trip_id || null,
    trip_component: l.trip_component || null,
    notes: l.notes || null,
  }));

  const { data, error } = await billingDb.rpc("create_billing_record", {
    p_record: payload,
    p_lines: linesPayload,
  });

  if (error) {
    console.error("RPC create_billing_record error:", error);
    throw error;
  }

  return billingRecordResponseSchema.parse(data);
}

export async function recordExternalSubmission(
  recordId: string,
  input: RecordSubmissionInput
): Promise<BillingRecord> {
  const { data, error } = await billingDb.rpc("record_external_submission", {
    p_record_id: recordId,
    p_submission: {
      occurred_at: input.occurred_at,
      submission_channel: input.submission_channel,
      submitted_by_name: input.submitted_by_name,
      external_reference: input.external_reference,
      purpose: input.purpose,
      notes: input.notes,
    },
  });

  if (error) {
    console.error("RPC record_external_submission error:", error);
    throw error;
  }

  return billingRecordResponseSchema.parse(data);
}

export async function recordPayerResponse(
  recordId: string,
  input: RecordResponseInput
): Promise<BillingRecord> {
  const { data, error } = await billingDb.rpc("record_payer_response", {
    p_record_id: recordId,
    p_response: {
      occurred_at: input.occurred_at,
      response_type: input.response_type,
      adjudication_status: input.adjudication_status,
      payer_claim_number: input.payer_claim_number,
      category_code: input.category_code,
      status_code: input.status_code,
      adjustment_group_code: input.adjustment_group_code,
      adjustment_reason_code: input.adjustment_reason_code,
      remark_code: input.remark_code,
      payer_reported_amount: input.payer_reported_amount,
      raw_description: input.raw_description,
      evidence_doc_name: input.evidence_doc_name,
      evidence_doc_reference: input.evidence_doc_reference,
      notes: input.notes,
    },
  });

  if (error) {
    console.error("RPC record_payer_response error:", error);
    throw error;
  }

  return billingRecordResponseSchema.parse(data);
}

export async function recordResubmission(
  originalRecordId: string,
  input: AddRecordInput
): Promise<BillingRecord> {
  const payload = {
    record_type: input.record_type,
    payer_id: input.payer_id,
    internal_reference: input.internal_reference,
    client_id: input.client_id,
    billing_period_start: input.billing_period_start,
    billing_period_end: input.billing_period_end,
    due_date: input.due_date,
    submission_status: input.submission_status,
    external_submitted_at: input.external_submitted_at,
    submitted_by_name: input.submitted_by_name,
    submission_channel: input.submission_channel,
    original_external_reference: input.original_external_reference,
    notes: input.notes,
    is_historical: input.is_historical,
    is_summary_only: input.is_summary_only,
    follow_up_owner_id: input.follow_up_owner_id,
    next_follow_up_date: input.next_follow_up_date,
    follow_up_notes: input.follow_up_notes,
  };

  const linesPayload = input.lines.map((l) => ({
    client_id: l.client_id,
    service_date: l.service_date,
    description: l.description,
    hcpcs_code: l.hcpcs_code || null,
    modifiers: l.modifiers || null,
    quantity: l.quantity,
    unit_type: l.unit_type,
    unit_rate: l.unit_rate || null,
    billed_amount: l.billed_amount,
    allowed_amount: l.allowed_amount || null,
    service_agreement_id: l.service_agreement_id || null,
    service_agreement_line_id: l.service_agreement_line_id || null,
    trip_id: l.trip_id || null,
    trip_component: l.trip_component || null,
    notes: l.notes || null,
  }));

  const { data, error } = await billingDb.rpc("record_resubmission", {
    p_original_record_id: originalRecordId,
    p_new_record: payload,
    p_lines: linesPayload,
  });

  if (error) {
    console.error("RPC record_resubmission error:", error);
    throw error;
  }

  return billingRecordResponseSchema.parse(data);
}

export async function updateFollowUp(
  recordId: string,
  followUpDate: string | null,
  followUpNotes: string | null
): Promise<void> {
  const { error } = await billingDb
    .from("billing_records")
    .update({
      next_follow_up_date: followUpDate,
      follow_up_notes: followUpNotes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", recordId);

  if (error) throw error;
}

/** Minimal record projection used by the payment allocation selector. */
export async function getBillingAllocationRecords(
  orgId: string,
  payerId?: string
): Promise<BillingAllocationRecord[]> {
  let query = billingDb
    .from("billing_records")
    .select("id, internal_reference, payer_id, outstanding_balance, client:patients(full_name)")
    .eq("org_id", orgId)
    .not("submission_status", "in", '("draft","cancelled","superseded")')
    .gt("outstanding_balance", 0)
    .order("created_at", { ascending: false });

  if (payerId) query = query.eq("payer_id", payerId);
  const { data, error } = await query;

  if (error) throw error;
  return billingAllocationRecordResponseSchema.array().parse(data ?? []);
}
