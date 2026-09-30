import { skipToken, useQuery } from "@tanstack/react-query";
import { useOrganization } from "@/contexts/OrganizationContext";
import {
  getBillingPayments,
  type PaymentFilterParams,
} from "../api/payments";
import { billingQueryKeys } from "./queryKeys";

export function useBillingPayments(filters: Omit<PaymentFilterParams, "orgId">) {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;

  return useQuery({
    queryKey: billingQueryKeys.payments(orgId || "", filters),
    queryFn: orgId ? () => getBillingPayments({ ...filters, orgId }) : skipToken,
    enabled: !!orgId,
  });
}
