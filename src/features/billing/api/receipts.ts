import type { z } from "zod";
import { billingDb } from "./client";
import { manualReceiptSchema } from "../types/manual-records";
import { billingPaymentResponseSchema } from "../types/responses";

export type ManualReceiptInput = z.infer<typeof manualReceiptSchema>;

export async function recordBillingReceipt(recordId: string, input: ManualReceiptInput) {
  const receipt = manualReceiptSchema.parse(input);
  const { data, error } = await billingDb.rpc("record_billing_receipt", {
    p_record_id: recordId,
    p_receipt: receipt,
  });
  if (error) throw error;
  return billingPaymentResponseSchema.parse(data);
}
