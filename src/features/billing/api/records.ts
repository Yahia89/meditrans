import { billingDb } from "./client";
import { readBillingRows } from "./pagination";
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
} from "../types/responses";

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
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });

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

  const records = billingRecordResponseSchema.array().parse(await readBillingRows(query));
  return filterBillingRecords(records, filters.search);
}

export function filterBillingRecords(records: BillingRecord[], searchText?: string): BillingRecord[] {
  const search = searchText?.trim().toLocaleLowerCase();
  // Search parsed text, not interpolated PostgREST filter syntax.
  if (!search) return records;
  return records.filter((record) => [
    record.internal_reference, record.original_external_reference,
    record.client?.full_name, record.payer?.name, record.notes,
  ].some((value) => value?.toLocaleLowerCase().includes(search)));
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
