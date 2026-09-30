import { billingPaymentResponseSchema } from "../types/responses";
import { billingDb } from "./client";
import { readBillingRows } from "./pagination";
import type { BillingPayment } from "../types/billing";

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
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });

  if (filters.payerId && filters.payerId !== "all") {
    query = query.eq("payer_id", filters.payerId);
  }
  if (filters.reconciliationStatus && filters.reconciliationStatus !== "all") {
    query = query.eq("reconciliation_status", filters.reconciliationStatus);
  }

  return billingPaymentResponseSchema.array().parse(await readBillingRows(query));
}
