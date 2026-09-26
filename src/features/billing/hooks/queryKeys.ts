import type { BillingRecordFilterParams } from "../api/records";
import type { PaymentFilterParams } from "../api/payments";

export const billingQueryKeys = {
  all: (orgId?: string) => ["billing", orgId] as const,
  records: (orgId: string, filters?: Omit<BillingRecordFilterParams, "orgId">) =>
    ["billing", orgId, "records", filters] as const,
  record: (orgId: string, recordId: string) =>
    ["billing", orgId, "record", recordId] as const,
  payments: (orgId: string, filters?: Omit<PaymentFilterParams, "orgId">) =>
    ["billing", orgId, "payments", filters] as const,
  payers: (orgId: string) =>
    ["billing", orgId, "payers"] as const,
  stats: (orgId: string) =>
    ["billing", orgId, "stats"] as const,
  billableTrips: (orgId: string) =>
    ["billing", orgId, "billable-trips"] as const,
  serviceAgreements: (orgId: string) =>
    ["billing", orgId, "service-agreements"] as const,
};
