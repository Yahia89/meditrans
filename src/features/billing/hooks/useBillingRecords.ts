import { skipToken, useQuery } from "@tanstack/react-query";
import { useOrganization } from "@/contexts/OrganizationContext";
import {
  getBillingRecords,
  getBillingRecordById,
  type BillingRecordFilterParams,
} from "../api/records";
import { billingQueryKeys } from "./queryKeys";

export function useBillingRecords(filters: Omit<BillingRecordFilterParams, "orgId">) {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;

  return useQuery({
    queryKey: billingQueryKeys.records(orgId || "", filters),
    queryFn: orgId ? () => getBillingRecords({ ...filters, orgId }) : skipToken,
    enabled: !!orgId,
  });
}

export function useBillingRecord(recordId: string | null) {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;

  return useQuery({
    queryKey: billingQueryKeys.record(orgId || "", recordId || ""),
    queryFn: orgId && recordId ? () => getBillingRecordById(recordId) : skipToken,
    enabled: !!orgId && !!recordId,
  });
}
