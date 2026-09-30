import { skipToken, useQuery } from "@tanstack/react-query";
import { useOrganization } from "@/contexts/OrganizationContext";
import { getBillingOverviewStats } from "../api/summary";
import { billingQueryKeys } from "./queryKeys";

export function useBillingStats() {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;

  return useQuery({
    queryKey: [...billingQueryKeys.stats(orgId || ""), currentOrganization?.timezone],
    queryFn: orgId ? () => getBillingOverviewStats(orgId, currentOrganization?.timezone || "America/Chicago") : skipToken,
    enabled: !!orgId,
  });
}
