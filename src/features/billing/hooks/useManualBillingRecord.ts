import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createManualBillingRecord } from "../api/manual-records";
import type { ManualBillingRecordInput } from "../types/manual-records";
import { billingQueryKeys } from "./queryKeys";

export function useCreateManualBillingRecord(orgId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ManualBillingRecordInput) => createManualBillingRecord(orgId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: billingQueryKeys.all(orgId) });
    },
  });
}
