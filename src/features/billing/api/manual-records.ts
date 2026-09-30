import { billingDb } from "./client";
import { manualBillingRecordSchema, type ManualBillingRecordInput } from "../types/manual-records";
import { billingRecordResponseSchema } from "../types/responses";

export async function createManualBillingRecord(orgId: string, input: ManualBillingRecordInput) {
  const record = manualBillingRecordSchema.parse(input);
  const { data, error } = await billingDb.rpc("create_manual_billing_record", {
    p_record: { ...record, org_id: orgId },
  });
  if (error) throw error;
  return billingRecordResponseSchema.parse(data);
}
