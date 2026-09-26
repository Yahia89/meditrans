import { skipToken, useQuery } from "@tanstack/react-query";
import { useOrganization } from "@/contexts/OrganizationContext";
import { getBillingOverviewStats } from "../api/summary";
import { billingQueryKeys } from "./queryKeys";

export function useBillingStats() {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;

  return useQuery({
    queryKey: billingQueryKeys.stats(orgId || ""),
    queryFn: orgId ? () => getBillingOverviewStats(orgId) : skipToken,
    enabled: !!orgId,
  });
}
