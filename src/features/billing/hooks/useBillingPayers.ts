import { skipToken, useQuery } from "@tanstack/react-query";
import { useOrganization } from "@/contexts/OrganizationContext";
import { getBillingPayers } from "../api/payers";
import { billingQueryKeys } from "./queryKeys";

/** Agencies are entered with a billing record; this read-only list powers filters. */
export function useBillingPayers() {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;
  return useQuery({
    queryKey: billingQueryKeys.payers(orgId || ""),
    queryFn: orgId ? () => getBillingPayers(orgId) : skipToken,
  });
}
