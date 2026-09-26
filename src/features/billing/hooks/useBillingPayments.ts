import { skipToken, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useOrganization } from "@/contexts/OrganizationContext";
import {
  getBillingPayments,
  recordPaymentAndAllocations,
  type PaymentFilterParams,
} from "../api/payments";
import type { RecordPaymentInput } from "../types/schemas";
import { billingQueryKeys } from "./queryKeys";
import { toast } from "sonner";

export function useBillingPayments(filters: Omit<PaymentFilterParams, "orgId">) {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;

  return useQuery({
    queryKey: billingQueryKeys.payments(orgId || "", filters),
    queryFn: orgId ? () => getBillingPayments({ ...filters, orgId }) : skipToken,
    enabled: !!orgId,
  });
}

export function useRecordPayment() {
  const queryClient = useQueryClient();
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;

  return useMutation({
    mutationFn: (input: RecordPaymentInput) => {
      if (!orgId) throw new Error("Organization not selected");
      return recordPaymentAndAllocations(orgId, input);
    },
    onSuccess: (data) => {
      toast.success(`Payment ${data.reference_number} recorded successfully`);
      if (orgId) {
        queryClient.invalidateQueries({ queryKey: billingQueryKeys.all(orgId) });
      }
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to record payment");
    },
  });
}
