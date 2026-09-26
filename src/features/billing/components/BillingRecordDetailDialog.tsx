import { BillingDialogContent, BillingDialogHeader, BillingDialogBody, BillingDialogFooter } from "./BillingDialogLayout";
import { useId, useRef, useState, type ChangeEvent } from "react";
import {
  Dialog,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  PaperPlaneTilt,
  ChartBar,
  Coins,
  Scales,
  FileText,
  UploadSimple,
  ArrowsClockwise,
  WarningCircle,
  DownloadSimple,
  CalendarCheck,
} from "@phosphor-icons/react";
import { useBillingRecord, useUpdateFollowUp } from "../hooks/useBillingRecords";
import {
  getSubmissionStatusMeta,
  getAdjudicationStatusMeta,
  getSettlementStatusMeta,
} from "../utils/status-helpers";
import { formatMoney } from "../utils/decimal";
import { RecordSubmissionDialog } from "./RecordSubmissionDialog";
import { RecordResponseDialog } from "./RecordResponseDialog";
import { RecordPaymentDialog } from "./RecordPaymentDialog";
import { RecordAdjustmentDialog } from "./RecordAdjustmentDialog";
import { uploadBillingDocument, getSignedDocumentUrl } from "../api/documents";
import { useQueryClient } from "@tanstack/react-query";
import { billingQueryKeys } from "../hooks/queryKeys";
import type { BillingRecord } from "../types/billing";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface BillingRecordDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recordId: string | null;
  onResubmitClick?: (record: BillingRecord) => void;
}

export function BillingRecordDetailDialog({
  open,
  onOpenChange,
  recordId,
  onResubmitClick,
}: BillingRecordDetailDialogProps) {
  const formId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { data, isLoading, isError, refetch } = useBillingRecord(recordId);
  const updateFollowUpMutation = useUpdateFollowUp();

  // Child dialogs
  const [submissionOpen, setSubmissionOpen] = useState(false);
  const [responseOpen, setResponseOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [adjustmentOpen, setAdjustmentOpen] = useState(false);

  // Follow-up editing state
  const [followUpDate, setFollowUpDate] = useState<string>("");
  const [followUpNotes, setFollowUpNotes] = useState<string>("");
  const [isEditingFollowUp, setIsEditingFollowUp] = useState<boolean>(false);

  // Document upload state
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);

  if (!recordId) return null;

  const record = data?.record;
  const lines = data?.lines || [];
  const attempts = data?.submissionAttempts || [];
  const responses = data?.payerResponses || [];
  const allocations = data?.allocations || [];
  const adjustments = data?.adjustments || [];
  const logs = data?.activityLogs || [];
  const documents = data?.documents || [];

  const subMeta = record ? getSubmissionStatusMeta(record.submission_status) : null;
  const adjMeta = record ? getAdjudicationStatusMeta(record.adjudication_status) : null;
  const setMeta = record ? getSettlementStatusMeta(record.settlement_status) : null;

  const handleSaveFollowUp = async () => {
    if (!recordId) return;
    try {
      await updateFollowUpMutation.mutateAsync({
        recordId,
        followUpDate: followUpDate || null,
        followUpNotes: followUpNotes || null,
      });
      setIsEditingFollowUp(false);
    } catch (err: unknown) {
      console.error("Failed to save follow-up", err instanceof Error ? err.message : err);
    }
  };

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !record) return;

    setIsUploadingDoc(true);
    try {
      await uploadBillingDocument({
        orgId: record.org_id,
        recordId: record.id,
        file,
        documentType: "claim_copy",
        notes: `Uploaded supporting document: ${file.name}`,
      });
      toast.success("Document attached successfully");
      queryClient.invalidateQueries({
        queryKey: billingQueryKeys.record(record.org_id, record.id),
      });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to upload document");
    } finally {
      setIsUploadingDoc(false);
      e.target.value = "";
    }
  };

  const handleDownloadDoc = async (storagePath: string) => {
    try {
      const url = await getSignedDocumentUrl(storagePath);
      window.open(url, "_blank");
    } catch {
      toast.error("Could not download document");
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <BillingDialogContent className="max-w-4xl">
          <BillingDialogHeader>
            <div className="flex min-w-0 flex-wrap items-center gap-2 pr-2">
              <DialogTitle className="min-w-0 break-words text-lg leading-snug [overflow-wrap:anywhere]">
                {record?.internal_reference ?? "Billing record"}
              </DialogTitle>
              {record && (
                <Badge variant="secondary">
                  {record.record_type === "dhs_claim" ? "DHS Direct Claim" : "Partner Invoice"}
                </Badge>
              )}
              {record?.superseded_by_record_id && <Badge variant="outline">Superseded Revision</Badge>}
            </div>
            <DialogDescription className="break-words leading-relaxed">
              {record ? (
                <>
                  {record.payer?.name ?? "Payer"} · {record.billing_period_start} to {record.billing_period_end}
                  {record.client && <> · {record.client.full_name}</>}
                </>
              ) : "Service details, external activity, and recorded payments."}
            </DialogDescription>
          </BillingDialogHeader>
          <BillingDialogBody>
            {isLoading ? (
              <div className="p-16 text-center flex flex-col gap-3">
                <ArrowsClockwise className="size-8 animate-spin motion-reduce:animate-none mx-auto text-muted-foreground" />
                <p className="text-xs text-muted-foreground font-medium">Loading record details...</p>
              </div>
            ) : isError || !record ? (
              <div className="p-12 text-center flex flex-col gap-3">
                <WarningCircle className="size-8 mx-auto text-destructive" />
                <p className="text-sm font-bold text-foreground">Failed to load record</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetch()}
                  className="h-auto min-h-11 whitespace-normal sm:min-h-9"
                >
                  Retry
                </Button>
              </div>
            ) : (
              <div className="flex min-w-0 flex-col gap-6 [overflow-wrap:anywhere]">


                {/* Financial Summary Strip */}
                <div className="grid min-w-0 grid-cols-2 gap-3 @3xl/billing-dialog:grid-cols-5 p-4 bg-muted/40 border border-border rounded-xl text-center">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Billed Charges
                    </span>
                    <div className="text-lg font-black text-foreground">
                      {formatMoney(record.total_billed_amount)}
                    </div>
                  </div>

                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Allowed
                    </span>
                    <div className="text-lg font-bold text-foreground">
                      {record.total_allowed_amount ? formatMoney(record.total_allowed_amount) : "—"}
                    </div>
                  </div>

                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Payments Received
                    </span>
                    <div className="text-lg font-black text-primary">
                      {formatMoney(record.total_paid_amount)}
                    </div>
                  </div>

                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Adjustments
                    </span>
                    <div className="text-lg font-bold text-primary">
                      {formatMoney(record.total_adjusted_amount)}
                    </div>
                  </div>

                  <div className="flex flex-col gap-0.5 col-span-2 @3xl/billing-dialog:col-span-1">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Outstanding Open
                    </span>
                    <div
                      className={cn("text-lg font-black tabular-nums", Number(record.outstanding_balance) > 0 ? "text-foreground" : "text-primary")}
                    >
                      {formatMoney(record.outstanding_balance)}
                    </div>
                  </div>
                </div>

                {/* Status Badges Row */}
                <div className="flex flex-wrap items-center gap-3 p-3 bg-background border border-border rounded-xl">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      Submission:
                    </span>
                    <Badge variant="secondary" className="max-w-full whitespace-normal">
                      {subMeta?.label}
                    </Badge>
                  </div>

                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      Payer Adjudication:
                    </span>
                    <Badge variant="secondary" className="max-w-full whitespace-normal">
                      {adjMeta?.label}
                    </Badge>
                  </div>

                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      Settlement:
                    </span>
                    <Badge variant="secondary" className="max-w-full whitespace-normal">
                      {setMeta?.label}
                    </Badge>
                  </div>
                </div>

                {/* Follow-up Section */}
                <div className="flex min-w-0 flex-col gap-4 rounded-xl border bg-muted/40 p-4 text-sm">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <CalendarCheck size={18} className="text-muted-foreground shrink-0" />
                    <div>
                      <span className="font-bold text-foreground mr-2">Follow-up:</span>
                      {record.next_follow_up_date ? (
                        <span className="text-foreground font-semibold">
                          Due {record.next_follow_up_date}
                          {record.follow_up_notes && ` — "${record.follow_up_notes}"`}
                        </span>
                      ) : (
                        <span className="text-muted-foreground italic">No scheduled follow-up</span>
                      )}
                    </div>
                  </div>

                  {!isEditingFollowUp ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setFollowUpDate(record.next_follow_up_date || "");
                        setFollowUpNotes(record.follow_up_notes || "");
                        setIsEditingFollowUp(true);
                      }}
                      className="h-auto min-h-11 whitespace-normal sm:min-h-9"
                    >
                      Edit Follow-up
                    </Button>
                  ) : (
                    <FieldGroup className="grid min-w-0 grid-cols-1 items-end gap-3 @lg/billing-dialog:grid-cols-2">
                      <Field className="min-w-0 gap-2">
                        <FieldLabel htmlFor={`${formId}-follow-up-date`}>Next follow-up date</FieldLabel>
                        <Input
                          id={`${formId}-follow-up-date`}
                          type="date"
                          value={followUpDate}
                          onChange={(e) => setFollowUpDate(e.target.value)}
                          className="h-11 min-w-0 text-base sm:h-10 md:text-sm"
                        />
                      </Field>
                      <Field className="min-w-0 gap-2">
                        <FieldLabel htmlFor={`${formId}-follow-up-notes`}>Follow-up notes</FieldLabel>
                        <Input
                          id={`${formId}-follow-up-notes`}
                          placeholder="Notes"
                          value={followUpNotes}
                          onChange={(e) => setFollowUpNotes(e.target.value)}
                          className="h-11 min-w-0 text-base sm:h-10 md:text-sm"
                        />
                      </Field>
                      <div className="flex flex-wrap gap-2 @lg/billing-dialog:col-span-2">
                        <Button
                          size="sm"
                          onClick={handleSaveFollowUp}
                          disabled={updateFollowUpMutation.isPending}
                          className="h-auto min-h-11 whitespace-normal sm:min-h-9"
                        >
                          Save
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setIsEditingFollowUp(false)}
                          className="h-auto min-h-11 whitespace-normal sm:min-h-9"
                        >
                          Cancel
                        </Button>
                      </div>
                    </FieldGroup>
                  )}
                </div>

                {/* Detail Tabs */}
                <Tabs defaultValue="lines" className="min-w-0 gap-4">
                  <div className="min-w-0 max-w-full overflow-x-auto pb-1">
                    <TabsList className="h-auto min-w-max justify-start">
                      <TabsTrigger value="lines" className="min-h-11 shrink-0 sm:min-h-9">
                        Service Lines ({lines.length})
                      </TabsTrigger>
                      <TabsTrigger value="submissions" className="min-h-11 shrink-0 sm:min-h-9">
                        Submissions ({attempts.length})
                      </TabsTrigger>
                      <TabsTrigger value="responses" className="min-h-11 shrink-0 sm:min-h-9">
                        Responses ({responses.length})
                      </TabsTrigger>
                      <TabsTrigger value="payments" className="min-h-11 shrink-0 sm:min-h-9">
                        Payments ({allocations.length})
                      </TabsTrigger>
                      <TabsTrigger value="adjustments" className="min-h-11 shrink-0 sm:min-h-9">
                        Adjustments ({adjustments.length})
                      </TabsTrigger>
                      <TabsTrigger value="documents" className="min-h-11 shrink-0 sm:min-h-9">
                        Documents ({documents.length})
                      </TabsTrigger>
                      <TabsTrigger value="activity" className="min-h-11 shrink-0 sm:min-h-9">
                        Activity ({logs.length})
                      </TabsTrigger>
                    </TabsList>
                  </div>

                  {/* Tab: Service Lines */}
                  <TabsContent value="lines" className="min-w-0 flex flex-col gap-2 mt-0">
                    <div className="border border-border min-w-0 max-w-full rounded-xl overflow-hidden bg-background">
                      <Table className="min-w-[680px]">
                        <TableHeader className="bg-muted/40">
                          <TableRow>
                            <TableHead className="text-xs font-bold text-foreground">Date</TableHead>
                            <TableHead className="text-xs font-bold text-foreground">Client</TableHead>
                            <TableHead className="text-xs font-bold text-foreground">Description</TableHead>
                            <TableHead className="text-xs font-bold text-foreground">HCPCS</TableHead>
                            <TableHead className="text-xs font-bold text-foreground">Qty / Unit</TableHead>
                            <TableHead className="text-xs font-bold text-foreground text-right">Rate</TableHead>
                            <TableHead className="text-xs font-bold text-foreground text-right">Billed</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {lines.map((l) => (
                            <TableRow key={l.id} className="text-xs">
                              <TableCell className="font-medium text-foreground">{l.service_date}</TableCell>
                              <TableCell className="font-semibold text-foreground">
                                {l.client?.full_name || "Assigned Client"}
                              </TableCell>
                              <TableCell>{l.description}</TableCell>
                              <TableCell className="font-mono text-muted-foreground">
                                {l.hcpcs_code || "—"}
                              </TableCell>
                              <TableCell>
                                {l.quantity} {l.unit_type.replace(/_/g, " ")}
                              </TableCell>
                              <TableCell className="text-right">
                                {l.unit_rate ? formatMoney(l.unit_rate) : "—"}
                              </TableCell>
                              <TableCell className="text-right font-bold text-foreground">
                                {formatMoney(l.billed_amount)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </TabsContent>

                  {/* Tab: Submission Attempts */}
                  <TabsContent value="submissions" className="min-w-0 flex flex-col gap-3 mt-0">
                    {attempts.length === 0 ? (
                      <div className="p-8 text-center text-xs text-muted-foreground bg-background border border-border rounded-xl">
                        No external submissions recorded yet for this draft.
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {attempts.map((att) => (
                          <div
                            key={att.id}
                            className="p-3.5 bg-background border border-border rounded-xl flex min-w-0 flex-col items-start justify-between gap-3 text-sm @lg/billing-dialog:flex-row"
                          >
                            <div className="flex flex-col gap-1">
                              <div className="flex min-w-0 flex-wrap items-center gap-2">
                                <Badge className="bg-muted/40 text-primary border-border text-xs">
                                  Attempt #{att.attempt_number} ({att.purpose.replace(/_/g, " ")})
                                </Badge>
                                <span className="font-bold text-foreground">
                                  Submitted on: {att.occurred_at.slice(0, 10)}
                                </span>
                              </div>
                              <div className="text-muted-foreground">
                                Channel: <strong className="text-foreground capitalize">{att.submission_channel.replace(/_/g, " ")}</strong>
                                {att.external_reference && (
                                  <> • External Ref: <strong className="text-foreground font-mono">{att.external_reference}</strong></>
                                )}
                                {att.submitted_by_name && (
                                  <> • Submitted by: <strong className="text-foreground">{att.submitted_by_name}</strong></>
                                )}
                              </div>
                              {att.notes && <p className="text-muted-foreground italic">"{att.notes}"</p>}
                            </div>
                            <div className="text-right">
                              <span className="text-xs text-muted-foreground uppercase font-bold block">
                                Frozen Snapshot
                              </span>
                              <span className="font-black text-foreground text-sm">
                                {formatMoney(att.snapshot_billed_amount)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  {/* Tab: Payer Responses */}
                  <TabsContent value="responses" className="min-w-0 flex flex-col gap-3 mt-0">
                    {responses.length === 0 ? (
                      <div className="p-8 text-center text-xs text-muted-foreground bg-background border border-border rounded-xl">
                        No payer responses recorded yet.
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {responses.map((resp) => (
                          <div
                            key={resp.id}
                            className="p-3.5 bg-background border border-border rounded-xl flex flex-col gap-2 text-xs"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div className="flex min-w-0 flex-wrap items-center gap-2">
                                <Badge className="bg-muted/40 text-primary border-border text-xs uppercase font-bold">
                                  {resp.response_type.replace(/_/g, " ")}
                                </Badge>
                                <span className="font-bold text-foreground">
                                  Date: {resp.occurred_at.slice(0, 10)}
                                </span>
                              </div>
                              {resp.payer_reported_amount && (
                                <span className="font-bold text-foreground text-xs">
                                  Payer Payable: {formatMoney(resp.payer_reported_amount)}
                                </span>
                              )}
                            </div>

                            {(resp.category_code || resp.status_code || resp.adjustment_reason_code) && (
                              <div className="flex flex-wrap items-center gap-4 text-xs font-mono text-muted-foreground p-2 bg-muted/40 rounded">
                                {resp.category_code && <span>Cat: {resp.category_code}</span>}
                                {resp.status_code && <span>Status: {resp.status_code}</span>}
                                {resp.adjustment_group_code && <span>Group: {resp.adjustment_group_code}</span>}
                                {resp.adjustment_reason_code && <span>CARC: {resp.adjustment_reason_code}</span>}
                                {resp.remark_code && <span>RARC: {resp.remark_code}</span>}
                              </div>
                            )}

                            {resp.raw_description && (
                              <p className="text-foreground italic bg-muted/40 p-2 rounded border border-border">
                                "{resp.raw_description}"
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  {/* Tab: Payments & Allocations */}
                  <TabsContent value="payments" className="min-w-0 flex flex-col gap-3 mt-0">
                    {allocations.length === 0 ? (
                      <div className="p-8 text-center text-xs text-muted-foreground bg-background border border-border rounded-xl">
                        No payments allocated to this record yet.
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {allocations.map((alloc) => (
                          <div
                            key={alloc.id}
                            className="p-3.5 bg-background border border-border rounded-xl flex min-w-0 flex-wrap items-center justify-between gap-3 text-sm"
                          >
                            <div className="flex flex-col gap-1">
                              <span className="font-bold text-foreground">
                                Ref: {alloc.payment?.reference_number || "Payment"}
                              </span>
                              <div className="text-muted-foreground">
                                Method: <strong className="capitalize">{alloc.payment?.payment_method}</strong> •
                                Received Date: <strong>{alloc.payment?.received_date || "Pending confirmation"}</strong>
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="text-xs text-muted-foreground font-bold uppercase block">
                                Allocated Amount
                              </span>
                              <span className="font-black text-primary text-sm">
                                {formatMoney(alloc.amount)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  {/* Tab: Adjustments */}
                  <TabsContent value="adjustments" className="min-w-0 flex flex-col gap-3 mt-0">
                    {adjustments.length === 0 ? (
                      <div className="p-8 text-center text-xs text-muted-foreground bg-background border border-border rounded-xl">
                        No adjustments posted.
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {adjustments.map((adj) => (
                          <div
                            key={adj.id}
                            className="p-3.5 bg-background border border-border rounded-xl flex min-w-0 flex-wrap items-center justify-between gap-3 text-sm"
                          >
                            <div className="flex flex-col gap-1">
                              <Badge className="bg-muted/40 text-primary border-border text-xs">
                                {adj.adjustment_type.replace(/_/g, " ")}
                              </Badge>
                              <p className="text-foreground font-medium">"{adj.reason}"</p>
                            </div>
                            <div className="text-right">
                              <span className="text-xs text-muted-foreground font-bold uppercase block">
                                Adjustment Amount
                              </span>
                              <span className="font-bold text-primary text-sm">
                                {formatMoney(adj.amount)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  {/* Tab: Attached Documents */}
                  <TabsContent value="documents" className="min-w-0 flex flex-col gap-3 mt-0">
                    <div className="flex flex-col items-start justify-between gap-3 @lg/billing-dialog:flex-row @lg/billing-dialog:items-center">
                      <span className="text-xs text-muted-foreground">
                        Upload signed claim copies, receipts, EOB PDFs, or remittance advice.
                      </span>
                      <div className="shrink-0">
                        <input
                          ref={fileInputRef}
                          type="file"
                          className="hidden"
                          aria-label="Attach billing document"
                          onChange={handleFileUpload}
                          disabled={isUploadingDoc}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={isUploadingDoc}
                          className="h-auto min-h-11 whitespace-normal sm:min-h-9"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <UploadSimple size={14} weight="bold" />
                          {isUploadingDoc ? "Uploading..." : "Attach Document"}
                        </Button>
                      </div>
                    </div>

                    {documents.length === 0 ? (
                      <div className="p-8 text-center text-xs text-muted-foreground bg-background border border-border rounded-xl">
                        No documents attached yet.
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {documents.map((doc) => (
                          <div
                            key={doc.id}
                            className="p-3 bg-background border border-border rounded-lg flex min-w-0 flex-wrap items-center justify-between gap-3 text-sm"
                          >
                            <div className="flex min-w-0 flex-wrap items-center gap-2.5">
                              <FileText size={18} weight="duotone" className="text-muted-foreground" />
                              <div>
                                <div className="font-semibold text-foreground">{doc.file_name}</div>
                                <div className="text-xs text-muted-foreground">
                                  {Math.round(doc.file_size / 1024)} KB • Attached {doc.uploaded_at.slice(0, 10)}
                                </div>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDownloadDoc(doc.storage_path)}
                              className="h-auto min-h-11 whitespace-normal sm:min-h-9"
                            >
                              <DownloadSimple size={14} />
                              Download
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  {/* Tab: Activity Logs */}
                  <TabsContent value="activity" className="min-w-0 flex flex-col gap-2 mt-0">
                    <div className="flex flex-col gap-2">
                      {logs.map((log) => (
                        <div
                          key={log.id}
                          className="p-3 bg-background border border-border rounded-lg text-xs flex flex-col gap-1"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3 text-muted-foreground text-xs">
                            <span className="font-bold text-foreground uppercase tracking-wider">
                              {log.event_type.replace(/_/g, " ")}
                            </span>
                            <span>{new Date(log.occurred_at).toLocaleString()}</span>
                          </div>
                          {log.notes && <p className="text-foreground font-medium">{log.notes}</p>}
                        </div>
                      ))}
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            )}
          </BillingDialogBody>
          {record && (
            <BillingDialogFooter className="grid grid-cols-2 sm:flex sm:flex-wrap">
              {record.submission_status === "draft" && (
                <Button
                  size="sm"
                  onClick={() => setSubmissionOpen(true)}
                  className="h-auto min-h-11 whitespace-normal sm:min-h-9"
                >
                  <PaperPlaneTilt size={14} weight="bold" />
                  Record Submission
                </Button>
              )}

              {record.submission_status !== "draft" && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setResponseOpen(true)}
                  className="h-auto min-h-11 whitespace-normal sm:min-h-9"
                >
                  <ChartBar size={14} weight="bold" className="text-primary" />
                  Record Response
                </Button>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={() => setPaymentOpen(true)}
                className="h-auto min-h-11 whitespace-normal sm:min-h-9"
              >
                <Coins size={14} weight="bold" className="text-primary" />
                Record Payment
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setAdjustmentOpen(true)}
                className="h-auto min-h-11 whitespace-normal sm:min-h-9"
              >
                <Scales size={14} weight="bold" className="text-primary" />
                Adjustment
              </Button>

              {(record.submission_status === "rejected" || record.adjudication_status === "denied") &&
                onResubmitClick && (
                  <Button
                    size="sm"
                    onClick={() => onResubmitClick(record)}
                    className="h-auto min-h-11 whitespace-normal sm:min-h-9"
                  >
                    <ArrowsClockwise size={14} weight="bold" />
                    Record Resubmission
                  </Button>
                )}

            </BillingDialogFooter>
          )}
        </BillingDialogContent>
      </Dialog>

      {/* Embedded Action Dialogs */}
      {record && (
        <>
          <RecordSubmissionDialog
            open={submissionOpen}
            onOpenChange={setSubmissionOpen}
            recordId={record.id}
            internalReference={record.internal_reference}
          />

          <RecordResponseDialog
            open={responseOpen}
            onOpenChange={setResponseOpen}
            recordId={record.id}
            internalReference={record.internal_reference}
          />

          <RecordPaymentDialog
            open={paymentOpen}
            onOpenChange={setPaymentOpen}
            preselectedRecordId={record.id}
          />

          <RecordAdjustmentDialog
            open={adjustmentOpen}
            onOpenChange={setAdjustmentOpen}
            recordId={record.id}
            internalReference={record.internal_reference}
          />
        </>
      )}
    </>
  );
}
