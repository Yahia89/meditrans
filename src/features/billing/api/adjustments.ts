import { billingRecordResponseSchema } from "../types/responses";
import { billingAdjustmentResponseSchema } from "../types/responses";
import { billingDb } from "./client";
import type { BillingAdjustment, BillingRecord } from "../types/billing";
import type { RecordAdjustmentInput } from "../types/schemas";

export async function recordAdjustment(
  recordId: string,
  input: RecordAdjustmentInput
): Promise<BillingRecord> {
  const { data, error } = await billingDb.rpc("record_adjustment", {
    p_record_id: recordId,
    p_adjustment: {
      adjustment_type: input.adjustment_type,
      amount: input.amount,
      reason: input.reason,
      record_line_id: input.record_line_id || null,
      authorized_by: input.authorized_by || null,
    },
  });

  if (error) {
    console.error("RPC record_adjustment error:", error);
    throw error;
  }

  return billingRecordResponseSchema.parse(data);
}

export async function getAdjustmentsForRecord(
  recordId: string
): Promise<BillingAdjustment[]> {
  const { data, error } = await billingDb
    .from("billing_adjustments")
    .select("*")
    .eq("record_id", recordId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return billingAdjustmentResponseSchema.array().parse(data ?? []);
}
