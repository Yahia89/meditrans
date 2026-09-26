import { billingPaymentResponseSchema } from "../types/responses";
import { billingDb } from "./client";
import type { BillingPayment } from "../types/billing";
import type { RecordPaymentInput } from "../types/schemas";

export interface PaymentFilterParams {
  orgId: string;
  payerId?: string;
  reconciliationStatus?: "unapplied" | "partially_applied" | "fully_applied" | "reconciled" | "all";
}

export async function getBillingPayments(
  filters: PaymentFilterParams
): Promise<BillingPayment[]> {
  let query = billingDb
    .from("billing_payments")
    .select(
      `
      *,
      payer:billing_payers(*),
      allocations:billing_payment_allocations(
        *,
        record:billing_records(id, internal_reference, record_type, total_billed_amount, outstanding_balance)
      )
    `
    )
    .eq("org_id", filters.orgId)
    .order("created_at", { ascending: false });

  if (filters.payerId && filters.payerId !== "all") {
    query = query.eq("payer_id", filters.payerId);
  }
  if (filters.reconciliationStatus && filters.reconciliationStatus !== "all") {
    query = query.eq("reconciliation_status", filters.reconciliationStatus);
  }

  const { data, error } = await query;
  if (error) {
    console.error("Error fetching billing payments:", error);
    throw error;
  }

  return billingPaymentResponseSchema.array().parse(data ?? []);
}

export async function recordPaymentAndAllocations(
  orgId: string,
  input: RecordPaymentInput
): Promise<BillingPayment> {
  const paymentPayload = {
    org_id: orgId,
    payer_id: input.payer_id,
    amount: input.amount,
    currency: "USD",
    payment_method: input.payment_method,
    reference_number: input.reference_number,
    payer_reported_date: input.payer_reported_date || null,
    received_date: input.received_date || null,
    notes: input.notes || null,
  };

  const allocationsPayload = (input.allocations || []).map((a) => ({
    record_id: a.record_id,
    record_line_id: a.record_line_id || null,
    amount: a.amount,
    notes: a.notes || null,
  }));

  const { data, error } = await billingDb.rpc("record_payment_and_allocations", {
    p_payment: paymentPayload,
    p_allocations: allocationsPayload,
  });

  if (error) {
    console.error("RPC record_payment_and_allocations error:", error);
    throw error;
  }

  return billingPaymentResponseSchema.parse(data);
}
