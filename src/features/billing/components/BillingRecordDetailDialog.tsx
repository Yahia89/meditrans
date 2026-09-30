import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { LoaderCircle, Download, FileText, CircleAlert } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useOrganization } from "@/contexts/OrganizationContext";
import { BillingDialogBody, BillingDialogContent, BillingDialogFooter, BillingDialogHeader } from "./BillingDialogLayout";
import { BillingFilesPicker } from "./BillingFilesPicker";
import { BillingReceiptForm } from "./BillingReceiptForm";
import { useBillingRecord } from "../hooks/useBillingRecords";
import { billingQueryKeys } from "../hooks/queryKeys";
import { getSignedDocumentUrl, uploadBillingFiles } from "../api/documents";
import { formatMoney, compareMoney } from "../utils/decimal";
import { formatBillingDate, formatBillingTimestamp } from "../utils/dates";
import { getSettlementStatusMeta } from "../utils/status-helpers";

interface BillingRecordDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recordId: string | null;
}

export function BillingRecordDetailDialog({ open, onOpenChange, recordId }: BillingRecordDetailDialogProps) {
  const { currentOrganization } = useOrganization();
  const timezone = currentOrganization?.timezone || "America/Chicago";
  const queryClient = useQueryClient();
  const { data, isLoading, isError, refetch } = useBillingRecord(recordId);
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [savingReceipt, setSavingReceipt] = useState(false);
  const [uploadErrors, setUploadErrors] = useState<string[]>([]);
  const record = data?.record;
  if (!recordId) return null;

  const originalAttempt = data?.submissionAttempts.reduce<typeof data.submissionAttempts[number] | undefined>((first, attempt) => !first || attempt.attempt_number < first.attempt_number ? attempt : first, undefined);
  const originalAmount = record?.original_submitted_amount ?? originalAttempt?.snapshot_billed_amount ?? record?.total_billed_amount;
  const reference = record?.client_id?.split("-")[0] || record?.internal_reference;
  const receivedAllocations = data?.allocations.filter((allocation) => allocation.payment?.received_at || allocation.payment?.received_date) ?? [];
  const pendingAllocations = data?.allocations.filter((allocation) => !allocation.payment?.received_at && !allocation.payment?.received_date) ?? [];
  const busy = uploading || savingReceipt;

  async function uploadFiles() {
    if (!record || uploading || files.length === 0) return;
    setUploading(true);
    setUploadErrors([]);
    try {
      const result = await uploadBillingFiles({ orgId: record.org_id, recordId: record.id, files });
      setFiles(result.failedFiles);
      setUploadErrors(result.errors);
      if (result.uploadedCount > 0) {
        toast.success(`${result.uploadedCount} ${result.uploadedCount === 1 ? "file attached" : "files attached"}`);
        void queryClient.invalidateQueries({ queryKey: billingQueryKeys.record(record.org_id, record.id) });
      }
      if (result.failedFiles.length > 0) toast.error("Some files could not be attached. Retry the remaining files.");
    } finally {
      setUploading(false);
    }
  }

  async function downloadFile(id: string, storagePath: string, fileName: string) {
    setDownloadingId(id);
    try {
      const url = await getSignedDocumentUrl(storagePath);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      link.rel = "noopener noreferrer";
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      toast.error("Could not download this file. Please try again.");
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!busy) onOpenChange(next); }}>
      <BillingDialogContent className="max-w-3xl" onEscapeKeyDown={(event) => { if (busy) event.preventDefault(); }} onInteractOutside={(event) => { if (busy) event.preventDefault(); }}>
        <BillingDialogHeader>
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <DialogTitle className="break-words text-lg">{record?.client?.full_name || "Billing record"}</DialogTitle>
            {record && <Badge variant="secondary">{getSettlementStatusMeta(record.settlement_status).label}</Badge>}
          </div>
          <DialogDescription>{record ? `${record.payer?.name || "Agency"} · Reference ${reference}` : "Submission, received amounts and billing files."}</DialogDescription>
        </BillingDialogHeader>
        <BillingDialogBody>
          {isLoading ? (
            <div className="flex flex-col items-center gap-3 py-12 text-sm text-muted-foreground" role="status"><LoaderCircle className="size-7 animate-spin motion-reduce:animate-none" />Loading billing record…</div>
          ) : isError || !record || !data ? (
            <div className="flex flex-col items-center gap-3 py-12"><CircleAlert className="size-7 text-destructive" /><p>Could not load this billing record.</p><Button variant="outline" onClick={() => refetch()}>Retry</Button></div>
          ) : (
            <div className="min-w-0 flex flex-col gap-6 [overflow-wrap:anywhere]">
              <dl className="grid grid-cols-1 gap-4 rounded-xl border bg-muted/30 p-4 @lg/billing-dialog:grid-cols-3">
                <div><dt className="text-xs text-muted-foreground">{record.external_submitted_at ? "Original submitted" : "Recorded amount"}</dt><dd className="mt-1 text-xl font-semibold tabular-nums">{formatMoney(originalAmount || "0")}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Received</dt><dd className="mt-1 text-xl font-semibold tabular-nums text-primary">{formatMoney(record.total_paid_amount)}</dd></div>
                <div><dt className="text-xs text-muted-foreground">Open balance</dt><dd className="mt-1 text-xl font-semibold tabular-nums">{formatMoney(record.outstanding_balance)}</dd></div>
              </dl>
              <dl className="grid grid-cols-1 gap-4 text-sm @lg/billing-dialog:grid-cols-2">
                <div><dt className="text-muted-foreground">Submitted</dt><dd className="mt-1 font-medium">{formatBillingTimestamp(record.external_submitted_at, timezone)}</dd></div>
                {!record.is_summary_only && <div><dt className="text-muted-foreground">Service period</dt><dd className="mt-1 font-medium">{formatBillingDate(record.billing_period_start)} – {formatBillingDate(record.billing_period_end)}</dd></div>}
                {record.original_external_reference && <div><dt className="text-muted-foreground">Agency reference</dt><dd className="mt-1 font-medium">{record.original_external_reference}</dd></div>}
                {record.due_date && <div><dt className="text-muted-foreground">Due date</dt><dd className="mt-1 font-medium">{formatBillingDate(record.due_date)}</dd></div>}
                {record.notes && <div className="@lg/billing-dialog:col-span-2"><dt className="text-muted-foreground">Notes</dt><dd className="mt-1 whitespace-pre-wrap">{record.notes}</dd></div>}
              </dl>
              {compareMoney(record.total_adjusted_amount, "0") !== 0 && <p className="text-xs text-muted-foreground">Open balance includes {formatMoney(record.total_adjusted_amount)} in previously recorded adjustments. Details are available in history.</p>}
              {originalAmount && compareMoney(originalAmount, record.total_billed_amount) !== 0 && <p className="text-xs text-muted-foreground">Current billed amount: {formatMoney(record.total_billed_amount)}. The original submission amount is preserved above.</p>}

              <section aria-labelledby="billing-received-heading" className="flex flex-col gap-3 border-t pt-5">
                <h3 id="billing-received-heading" className="font-semibold">Received amounts</h3>
                {receivedAllocations.length === 0 ? <p className="text-sm text-muted-foreground">No money received yet.</p> : (
                  <ul className="flex flex-col gap-2">
                    {receivedAllocations.map((allocation) => (
                      <li key={allocation.id} className="flex min-w-0 flex-wrap justify-between gap-3 rounded-lg border p-3 text-sm">
                        <div className="min-w-0 flex flex-col gap-1">
                          <p className="font-medium">{allocation.payment?.received_at ? formatBillingTimestamp(allocation.payment.received_at, timezone) : allocation.payment?.received_date ? `${formatBillingDate(allocation.payment.received_date)} · Time not recorded` : "Receipt date not recorded"}</p>
                          <p className="text-xs text-muted-foreground">{allocation.payment?.reference_number || "Payment"}{allocation.payment?.payment_method && allocation.payment.payment_method !== "other" ? ` · ${allocation.payment.payment_method.replace(/_/g, " ").toUpperCase()}` : ""}</p>
                          {allocation.payment?.notes && <p className="whitespace-pre-wrap text-xs text-muted-foreground">{allocation.payment.notes}</p>}
                        </div>
                        <span className="font-semibold tabular-nums">{formatMoney(allocation.amount)}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {!record.superseded_by_record_id && !["cancelled", "superseded", "draft"].includes(record.submission_status) && <BillingReceiptForm recordId={record.id} orgId={record.org_id} timezone={timezone} submittedAt={record.external_submitted_at} onSavingChange={setSavingReceipt} />}
              </section>

              <section aria-labelledby="billing-files-heading" className="flex flex-col gap-3 border-t pt-5">
                <h3 id="billing-files-heading" className="font-semibold">Billing files</h3>
                {data.documents.length > 0 && <ul className="flex flex-col gap-2">{data.documents.map((file) => (
                  <li key={file.id} className="flex min-w-0 flex-wrap items-center gap-3 rounded-lg border p-3 text-sm">
                    <FileText className="size-5 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1"><p className="break-all font-medium">{file.file_name}</p><p className="text-xs text-muted-foreground">{Math.max(1, Math.round(file.file_size / 1024))} KB · {formatBillingTimestamp(file.uploaded_at, timezone)}</p></div>
                    <Button variant="ghost" size="sm" disabled={downloadingId === file.id} onClick={() => downloadFile(file.id, file.storage_path, file.file_name)} aria-label={`Download ${file.file_name}`} className="min-h-11 sm:min-h-9"><Download />{downloadingId === file.id ? "Preparing…" : "Download"}</Button>
                  </li>
                ))}</ul>}
                <BillingFilesPicker files={files} onFilesChange={(next) => { setFiles(next); setUploadErrors([]); }} disabled={busy} />
                {uploadErrors.length > 0 && <div role="alert" className="flex flex-col gap-1 text-xs text-destructive">{uploadErrors.map((error) => <p key={error}>{error}</p>)}</div>}
                {files.length > 0 && <Button onClick={uploadFiles} disabled={busy} className="min-h-11 sm:min-h-9">{uploading ? "Uploading…" : `Upload ${files.length === 1 ? "file" : `${files.length} files`}`}</Button>}
              </section>

              <details className="rounded-lg border p-4 text-sm">
                <summary className="cursor-pointer font-medium">History and saved details</summary>
                <div className="mt-4 flex flex-col gap-4">
                  <p className="text-xs text-muted-foreground">Created {formatBillingTimestamp(record.created_at, timezone)}</p>
                  {record.submission_status === "draft" && <p className="text-muted-foreground">Saved draft · No submission date recorded</p>}
                  {record.superseded_by_record_id && <p className="text-muted-foreground">This record has been replaced by a later revision.</p>}
                  {record.internal_reference !== reference && <p className="text-muted-foreground">Previous reference: {record.internal_reference}</p>}
                  {record.follow_up_notes && <p className="whitespace-pre-wrap text-muted-foreground">Previous follow-up notes: {record.follow_up_notes}</p>}
                  {!record.is_summary_only && data.lines.length > 0 && <div className="flex flex-col gap-2"><h4 className="font-medium">Service details</h4>{data.lines.map((line) => <div key={line.id} className="rounded-md bg-muted/30 p-3"><div className="flex flex-wrap justify-between gap-2"><span>{line.description}</span><span className="tabular-nums">{formatMoney(line.billed_amount)}</span></div><p className="mt-1 text-xs text-muted-foreground">{formatBillingDate(line.service_date)} · {line.client?.full_name || "Patient"} · {line.quantity} {line.unit_type.replace(/_/g, " ")}{line.hcpcs_code ? ` · ${line.hcpcs_code}` : ""}</p></div>)}</div>}
                  {pendingAllocations.length > 0 && <div className="flex flex-col gap-2"><h4 className="font-medium">Payments awaiting receipt confirmation</h4><p className="text-xs text-muted-foreground">These saved payments have no received date and are excluded from the received total.</p>{pendingAllocations.map((allocation) => <div key={allocation.id} className="flex flex-wrap justify-between gap-2 rounded-md bg-muted/30 p-3"><span>{allocation.payment?.reference_number || "Saved payment"}</span><span className="tabular-nums">{formatMoney(allocation.amount)}</span></div>)}</div>}
                  {data.submissionAttempts.length > 0 && <div className="flex flex-col gap-2"><h4 className="font-medium">Submissions</h4>{data.submissionAttempts.map((attempt) => <div key={attempt.id} className="rounded-md bg-muted/30 p-3"><div className="flex flex-wrap justify-between gap-2"><span>{formatBillingTimestamp(attempt.occurred_at, timezone)}</span><span className="tabular-nums">{formatMoney(attempt.snapshot_billed_amount)}</span></div>{attempt.external_reference && <p className="mt-1 text-xs text-muted-foreground">{attempt.external_reference}</p>}{attempt.notes && <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">{attempt.notes}</p>}</div>)}</div>}
                  {data.payerResponses.length > 0 && <div className="flex flex-col gap-2"><h4 className="font-medium">Saved agency responses</h4>{data.payerResponses.map((response) => <div key={response.id} className="rounded-md bg-muted/30 p-3"><p className="capitalize">{response.response_type.replace(/_/g, " ")} · {formatBillingTimestamp(response.occurred_at, timezone)}</p>{response.payer_reported_amount && <p className="mt-1">Reported amount: {formatMoney(response.payer_reported_amount)}</p>}{response.raw_description && <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">{response.raw_description}</p>}</div>)}</div>}
                  {data.adjustments.length > 0 && <div className="flex flex-col gap-2"><h4 className="font-medium">Saved adjustments</h4>{data.adjustments.map((adjustment) => <div key={adjustment.id} className="rounded-md bg-muted/30 p-3"><div className="flex flex-wrap justify-between gap-2"><span>{adjustment.reason}</span><span className="tabular-nums">{formatMoney(adjustment.amount)}</span></div><p className="mt-1 text-xs text-muted-foreground">{formatBillingTimestamp(adjustment.created_at, timezone)}</p></div>)}</div>}
                  {data.activityLogs.length > 0 && <div className="flex flex-col gap-2"><h4 className="font-medium">Activity</h4>{data.activityLogs.map((log) => <div key={log.id} className="border-l-2 pl-3"><p className="capitalize">{log.event_type.replace(/_/g, " ")}</p><p className="text-xs text-muted-foreground">{formatBillingTimestamp(log.occurred_at, timezone)}{log.actor_name ? ` · ${log.actor_name}` : ""}</p>{log.notes && <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">{log.notes}</p>}</div>)}</div>}
                </div>
              </details>
            </div>
          )}
        </BillingDialogBody>
        <BillingDialogFooter><Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>Close</Button></BillingDialogFooter>
      </BillingDialogContent>
    </Dialog>
  );
}
