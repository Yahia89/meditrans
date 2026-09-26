import { skipToken, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useOrganization } from "@/contexts/OrganizationContext";
import {
  getBillingRecords,
  getBillingRecordById,
  createBillingRecord,
  recordExternalSubmission,
  recordPayerResponse,
  recordResubmission,
  updateFollowUp,
  type BillingRecordFilterParams,
} from "../api/records";
import type { AddRecordInput, RecordSubmissionInput, RecordResponseInput } from "../types/schemas";
import { billingQueryKeys } from "./queryKeys";
import { toast } from "sonner";

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

export function useCreateBillingRecord() {
  const queryClient = useQueryClient();
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;

  return useMutation({
    mutationFn: (input: AddRecordInput) => {
      if (!orgId) throw new Error("Organization not selected");
      return createBillingRecord(orgId, input);
    },
    onSuccess: (data) => {
      toast.success(
        data.submission_status === "submitted"
          ? "External submission recorded successfully"
          : "Billing record draft created"
      );
      if (orgId) {
        queryClient.invalidateQueries({ queryKey: billingQueryKeys.all(orgId) });
      }
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to create billing record");
    },
  });
}

export function useRecordExternalSubmission() {
  const queryClient = useQueryClient();
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;

  return useMutation({
    mutationFn: ({ recordId, input }: { recordId: string; input: RecordSubmissionInput }) => {
      return recordExternalSubmission(recordId, input);
    },
    onSuccess: () => {
      toast.success("External submission recorded successfully");
      if (orgId) {
        queryClient.invalidateQueries({ queryKey: billingQueryKeys.all(orgId) });
      }
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to record submission");
    },
  });
}

export function useRecordPayerResponse() {
  const queryClient = useQueryClient();
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;

  return useMutation({
    mutationFn: ({ recordId, input }: { recordId: string; input: RecordResponseInput }) => {
      return recordPayerResponse(recordId, input);
    },
    onSuccess: () => {
      toast.success("Payer response recorded");
      if (orgId) {
        queryClient.invalidateQueries({ queryKey: billingQueryKeys.all(orgId) });
      }
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to record response");
    },
  });
}

export function useRecordResubmission() {
  const queryClient = useQueryClient();
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;

  return useMutation({
    mutationFn: ({
      originalRecordId,
      input,
    }: {
      originalRecordId: string;
      input: AddRecordInput;
    }) => {
      return recordResubmission(originalRecordId, input);
    },
    onSuccess: (data) => {
      toast.success(`Resubmission revision ${data.internal_reference} recorded`);
      if (orgId) {
        queryClient.invalidateQueries({ queryKey: billingQueryKeys.all(orgId) });
      }
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to record resubmission");
    },
  });
}

export function useUpdateFollowUp() {
  const queryClient = useQueryClient();
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;

  return useMutation({
    mutationFn: ({
      recordId,
      followUpDate,
      followUpNotes,
    }: {
      recordId: string;
      followUpDate: string | null;
      followUpNotes: string | null;
    }) => {
      return updateFollowUp(recordId, followUpDate, followUpNotes);
    },
    onSuccess: () => {
      toast.success("Follow-up updated");
      if (orgId) {
        queryClient.invalidateQueries({ queryKey: billingQueryKeys.all(orgId) });
      }
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to update follow-up");
    },
  });
}
