import { billingPayerResponseSchema } from "../types/responses";
import { billingDb } from "./client";
import type { BillingPayer } from "../types/billing";

export async function getBillingPayers(orgId: string): Promise<BillingPayer[]> {
  const { data, error } = await billingDb
    .from("billing_payers")
    .select("*")
    .eq("org_id", orgId)
    .order("name", { ascending: true });

  if (error) {
    console.error("Error fetching billing payers:", error);
    throw error;
  }

  return billingPayerResponseSchema.array().parse(data ?? []);
}
