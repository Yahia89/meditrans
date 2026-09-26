import { skipToken, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useOrganization } from "@/contexts/OrganizationContext";
import {
  getBillingPayers,
  createBillingPayer,
  updateBillingPayer,
  seedStandardPayers,
} from "../api/payers";
import type { PayerConfigInput } from "../types/schemas";
import { billingQueryKeys } from "./queryKeys";
import { toast } from "sonner";

export function useBillingPayers() {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;

  return useQuery({
    queryKey: billingQueryKeys.payers(orgId || ""),
    queryFn: orgId ? () => getBillingPayers(orgId) : skipToken,
    enabled: !!orgId,
  });
}

export function useCreatePayer() {
  const queryClient = useQueryClient();
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;

  return useMutation({
    mutationFn: (input: PayerConfigInput) => {
      if (!orgId) throw new Error("Organization not selected");
      return createBillingPayer(orgId, input);
    },
    onSuccess: (data) => {
      toast.success(`Payer "${data.name}" added`);
      if (orgId) {
        queryClient.invalidateQueries({ queryKey: billingQueryKeys.payers(orgId) });
      }
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to add payer");
    },
  });
}

export function useUpdatePayer() {
  const queryClient = useQueryClient();
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;

  return useMutation({
    mutationFn: ({ payerId, input }: { payerId: string; input: Partial<PayerConfigInput> }) => {
      return updateBillingPayer(payerId, input);
    },
    onSuccess: (data) => {
      toast.success(`Payer "${data.name}" updated`);
      if (orgId) {
        queryClient.invalidateQueries({ queryKey: billingQueryKeys.payers(orgId) });
      }
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to update payer");
    },
  });
}

export function useSeedStandardPayers() {
  const queryClient = useQueryClient();
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;

  return useMutation({
    mutationFn: () => {
      if (!orgId) throw new Error("Organization not selected");
      return seedStandardPayers(orgId);
    },
    onSuccess: (data) => {
      toast.success(`Configured ${data.length} standard payers (DHS / MHCP and Connectivity of MN)`);
      if (orgId) {
        queryClient.invalidateQueries({ queryKey: billingQueryKeys.payers(orgId) });
      }
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to configure standard payers");
    },
  });
}
