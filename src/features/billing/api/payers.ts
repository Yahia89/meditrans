import { billingPayerResponseSchema } from "../types/responses";
import { billingDb } from "./client";
import type { BillingPayer } from "../types/billing";
import type { PayerConfigInput } from "../types/schemas";

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

export async function createBillingPayer(
  orgId: string,
  input: PayerConfigInput
): Promise<BillingPayer> {
  const { data, error } = await billingDb
    .from("billing_payers")
    .insert({
      org_id: orgId,
      name: input.name,
      payer_type: input.payer_type,
      submission_channel: input.submission_channel,
      contact_name: input.contact_name || null,
      contact_email: input.contact_email || null,
      contact_phone: input.contact_phone || null,
      payment_terms: input.payment_terms || null,
      typical_follow_up_days: input.typical_follow_up_days,
      is_active: input.is_active,
      notes: input.notes || null,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating billing payer:", error);
    throw error;
  }

  return billingPayerResponseSchema.parse(data);
}

export async function updateBillingPayer(
  payerId: string,
  input: Partial<PayerConfigInput>
): Promise<BillingPayer> {
  const { data, error } = await billingDb
    .from("billing_payers")
    .update({
      ...input,
      updated_at: new Date().toISOString(),
    })
    .eq("id", payerId)
    .select()
    .single();

  if (error) {
    console.error("Error updating billing payer:", error);
    throw error;
  }

  return billingPayerResponseSchema.parse(data);
}

/**
 * Configure standard default payers for the organization:
 * 1. DHS / MHCP Direct Billing
 * 2. Connectivity of MN
 */
export async function seedStandardPayers(orgId: string): Promise<BillingPayer[]> {
  const defaults = [
    {
      org_id: orgId,
      name: "DHS / MHCP Direct",
      payer_type: "medicaid_direct" as const,
      submission_channel: "mn_its_dde" as const,
      typical_follow_up_days: null,
      payment_terms: null,
      notes: "Direct Medicaid billing via MN-ITS DDE portal.",
      is_active: true,
    },
    {
      org_id: orgId,
      name: "Connectivity of MN",
      payer_type: "broker_partner" as const,
      submission_channel: "other" as const,
      typical_follow_up_days: null,
      payment_terms: null,
      notes: "Partner invoices for clients referred through Connectivity of MN.",
      is_active: true,
    },
  ];

  // Re-running setup must preserve terms and contact details already configured
  // by the organization. Both inserts succeed or fail together.
  const { error } = await billingDb
    .from("billing_payers")
    .upsert(defaults, { onConflict: "org_id,name", ignoreDuplicates: true });
  if (error) throw error;

  const { data, error: selectError } = await billingDb
    .from("billing_payers")
    .select("*")
    .eq("org_id", orgId)
    .in("name", defaults.map((payer) => payer.name));
  if (selectError) throw selectError;
  return billingPayerResponseSchema.array().parse(data ?? []);
}
