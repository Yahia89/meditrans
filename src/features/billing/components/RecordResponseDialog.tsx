import { BillingDialogContent, BillingDialogHeader, BillingDialogBody, BillingDialogFooter } from "./BillingDialogLayout";
import { useId, useState, type FormEvent } from "react";
import {
  Dialog,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ChartBar, ArrowsClockwise } from "@phosphor-icons/react";
import { useRecordPayerResponse } from "../hooks/useBillingRecords";
import { recordResponseSchema, type RecordResponseInput } from "../types/schemas";
import { toast } from "sonner";

interface RecordResponseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recordId: string;
  internalReference: string;
}

export function RecordResponseDialog({
  open,
  onOpenChange,
  recordId,
  internalReference,
}: RecordResponseDialogProps) {
  const formId = useId();
  const [occurredAt, setOccurredAt] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [responseType, setResponseType] = useState<RecordResponseInput["response_type"]>("acknowledgement");
  const [adjudicationStatus, setAdjudicationStatus] = useState<NonNullable<RecordResponseInput["adjudication_status"]>>("in_review");
  const [payerClaimNumber, setPayerClaimNumber] = useState<string>("");
  const [categoryCode, setCategoryCode] = useState<string>("");
  const [statusCode, setStatusCode] = useState<string>("");
  const [adjustmentGroupCode, setAdjustmentGroupCode] = useState<string>("");
  const [adjustmentReasonCode, setAdjustmentReasonCode] = useState<string>("");
  const [remarkCode, setRemarkCode] = useState<string>("");
  const [payerReportedAmount, setPayerReportedAmount] = useState<string>("");
  const [rawDescription, setRawDescription] = useState<string>("");
  const [evidenceDocName, setEvidenceDocName] = useState<string>("");
  const [evidenceDocReference, setEvidenceDocReference] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  const responseMutation = useRecordPayerResponse();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!occurredAt) {
      toast.error("Please specify response date");
      return;
    }

    try {
      await responseMutation.mutateAsync({
        recordId,
        input: {
          occurred_at: `${occurredAt}T12:00:00Z`,
          response_type: responseType,
          adjudication_status:
            responseType !== "acknowledgement"
              ? adjudicationStatus
              : undefined,
          payer_claim_number: payerClaimNumber.trim() || undefined,
          category_code: categoryCode.trim() || undefined,
          status_code: statusCode.trim() || undefined,
          adjustment_group_code: adjustmentGroupCode.trim() || undefined,
          adjustment_reason_code: adjustmentReasonCode.trim() || undefined,
          remark_code: remarkCode.trim() || undefined,
          payer_reported_amount: payerReportedAmount.trim() || undefined,
          raw_description: rawDescription.trim() || undefined,
          evidence_doc_name: evidenceDocName.trim() || undefined,
          evidence_doc_reference: evidenceDocReference.trim() || undefined,
          notes: notes.trim() || undefined,
        },
      });
      onOpenChange(false);
    } catch (err: unknown) {
      console.error("Failed to record payer response:", err instanceof Error ? err.message : err);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <BillingDialogContent className="max-w-xl">
        <BillingDialogHeader>
          <DialogTitle className="flex items-start gap-2 text-lg leading-snug [&_svg]:shrink-0">
            <ChartBar size={20} weight="bold" className="text-primary" />
            Record Payer Response
          </DialogTitle>
          <DialogDescription className="leading-relaxed">
            For record: <span className="font-bold text-foreground">{internalReference}</span>
          </DialogDescription>
        </BillingDialogHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <BillingDialogBody>
            <FieldGroup className="grid min-w-0 grid-cols-1 gap-4 @lg/billing-dialog:grid-cols-2">
              <Field className="min-w-0 gap-2">
                <FieldLabel htmlFor={`${formId}-field-1`} className="leading-snug">Response Date *</FieldLabel>
                <Input id={`${formId}-field-1`}
                  type="date"
                  value={occurredAt}
                  onChange={(e) => setOccurredAt(e.target.value)}
                  className="h-11 min-w-0 text-base sm:h-10 md:text-sm"
                  required
                />
              </Field>

              <Field className="min-w-0 gap-2">
                <FieldLabel htmlFor={`${formId}-field-2`} className="leading-snug">Response Type *</FieldLabel>
                <Select
                  value={responseType}
                  onValueChange={(value) => {
                    const result = recordResponseSchema.shape.response_type.safeParse(value);
                    if (result.success) setResponseType(result.data);
                  }}
                >
                  <SelectTrigger id={`${formId}-field-2`} className="w-full min-w-0 text-base data-[size=default]:h-11 sm:data-[size=default]:h-10 md:text-sm [&_[data-slot=select-value]]:min-w-0 [&_[data-slot=select-value]]:truncate">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper" className="billing-surface w-[var(--radix-select-trigger-width)] max-w-[calc(100vw-2rem)] [&_[data-slot=select-item]]:whitespace-normal [&_[data-slot=select-item]]:break-words">
                    <SelectGroup>
                      <SelectItem value="acknowledgement">Receipt Acknowledgement (e.g. 999 / Portal)</SelectItem>
                      <SelectItem value="review_notice">Review Notice / Suspended</SelectItem>
                      <SelectItem value="approval">Approval (Formal EOB / 835)</SelectItem>
                      <SelectItem value="partial_approval">Partial Approval / Reduction</SelectItem>
                      <SelectItem value="denial">Denial Notice</SelectItem>
                      <SelectItem value="dispute">Partner Dispute / Inquiry</SelectItem>
                      <SelectItem value="other">Other Response</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            </FieldGroup>

            {responseType !== "acknowledgement" && (
              <Field className="min-w-0 gap-2">
                <FieldLabel htmlFor={`${formId}-field-3`} className="leading-snug">
                  Normalized Adjudication Status
                </FieldLabel>
                <Select
                  value={adjudicationStatus}
                  onValueChange={(value) => {
                    const result = recordResponseSchema.shape.adjudication_status.safeParse(value);
                    if (result.success && result.data) setAdjudicationStatus(result.data);
                  }}
                >
                  <SelectTrigger id={`${formId}-field-3`} className="w-full min-w-0 text-base data-[size=default]:h-11 sm:data-[size=default]:h-10 md:text-sm [&_[data-slot=select-value]]:min-w-0 [&_[data-slot=select-value]]:truncate">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper" className="billing-surface w-[var(--radix-select-trigger-width)] max-w-[calc(100vw-2rem)] [&_[data-slot=select-item]]:whitespace-normal [&_[data-slot=select-item]]:break-words">
                    <SelectGroup>
                      <SelectItem value="in_review">Under Review / Suspended</SelectItem>
                      <SelectItem value="approved">Approved — Payment Outstanding</SelectItem>
                      <SelectItem value="partially_approved">Partially Approved</SelectItem>
                      <SelectItem value="denied">Denied</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            )}

            {/* Raw Payer Codes Grid */}
            <div className="flex flex-col gap-2 p-3 bg-muted/40 border border-border rounded-lg">
              <span className="text-xs font-bold text-foreground uppercase tracking-wider block">
                Raw Payer Codes & Evidence (Preserved As-Is)
              </span>

              <FieldGroup className="grid min-w-0 grid-cols-1 gap-4 @lg/billing-dialog:grid-cols-2">
                <Field className="min-w-0 gap-2">
                  <FieldLabel htmlFor={`${formId}-field-4`} className="leading-snug">Payer Claim #</FieldLabel>
                  <Input id={`${formId}-field-4`}
                    placeholder="ICN / PCN"
                    value={payerClaimNumber}
                    onChange={(e) => setPayerClaimNumber(e.target.value)}
                    className="h-11 min-w-0 text-base sm:h-10 md:text-sm font-mono"
                  />
                </Field>

                <Field className="min-w-0 gap-2">
                  <FieldLabel htmlFor={`${formId}-field-5`} className="leading-snug">Group Code (CO/PR)</FieldLabel>
                  <Input id={`${formId}-field-5`}
                    placeholder="CO, PR, OA"
                    value={adjustmentGroupCode}
                    onChange={(e) => setAdjustmentGroupCode(e.target.value)}
                    className="h-11 min-w-0 text-base sm:h-10 md:text-sm font-mono"
                  />
                </Field>

                <Field className="min-w-0 gap-2">
                  <FieldLabel htmlFor={`${formId}-field-6`} className="leading-snug">Reason (CARC)</FieldLabel>
                  <Input id={`${formId}-field-6`}
                    placeholder="e.g. 45, 96, 16"
                    value={adjustmentReasonCode}
                    onChange={(e) => setAdjustmentReasonCode(e.target.value)}
                    className="h-11 min-w-0 text-base sm:h-10 md:text-sm font-mono"
                  />
                </Field>

                <Field className="min-w-0 gap-2">
                  <FieldLabel htmlFor={`${formId}-field-7`} className="leading-snug">Remark (RARC)</FieldLabel>
                  <Input id={`${formId}-field-7`}
                    placeholder="e.g. N130, MA04"
                    value={remarkCode}
                    onChange={(e) => setRemarkCode(e.target.value)}
                    className="h-11 min-w-0 text-base sm:h-10 md:text-sm font-mono"
                  />
                </Field>

                <Field className="min-w-0 gap-2">
                  <FieldLabel htmlFor={`${formId}-field-8`} className="leading-snug">Category Code</FieldLabel>
                  <Input id={`${formId}-field-8`}
                    placeholder="e.g. A1, E1"
                    value={categoryCode}
                    onChange={(e) => setCategoryCode(e.target.value)}
                    className="h-11 min-w-0 text-base sm:h-10 md:text-sm font-mono"
                  />
                </Field>

                <Field className="min-w-0 gap-2">
                  <FieldLabel htmlFor={`${formId}-field-9`} className="leading-snug">Status Code</FieldLabel>
                  <Input id={`${formId}-field-9`}
                    placeholder="e.g. 19, 20"
                    value={statusCode}
                    onChange={(e) => setStatusCode(e.target.value)}
                    className="h-11 min-w-0 text-base sm:h-10 md:text-sm font-mono"
                  />
                </Field>

                <Field className="min-w-0 gap-2">
                  <FieldLabel htmlFor={`${formId}-field-10`} className="leading-snug">Payer Payable ($)</FieldLabel>
                  <Input id={`${formId}-field-10`}
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={payerReportedAmount}
                    onChange={(e) => setPayerReportedAmount(e.target.value)}
                    className="h-11 min-w-0 text-base sm:h-10 md:text-sm"
                  />
                </Field>
              </FieldGroup>

              <Field className="min-w-0 gap-2">
                <FieldLabel htmlFor={`${formId}-field-11`} className="leading-snug">
                  Exact Payer Description / Message
                </FieldLabel>
                <Input id={`${formId}-field-11`}
                  placeholder="Verbatim payer message from remittance or letter"
                  value={rawDescription}
                  onChange={(e) => setRawDescription(e.target.value)}
                  className="h-11 min-w-0 text-base sm:h-10 md:text-sm"
                />
              </Field>
            </div>

            {/* Evidence document reference */}
            <FieldGroup className="grid min-w-0 grid-cols-1 gap-4 @lg/billing-dialog:grid-cols-2">
              <Field className="min-w-0 gap-2">
                <FieldLabel htmlFor={`${formId}-field-12`} className="leading-snug">Evidence Document Name</FieldLabel>
                <Input id={`${formId}-field-12`}
                  placeholder="e.g. RA_2026_07_20.pdf"
                  value={evidenceDocName}
                  onChange={(e) => setEvidenceDocName(e.target.value)}
                  className="h-11 min-w-0 text-base sm:h-10 md:text-sm"
                />
              </Field>
              <Field className="min-w-0 gap-2">
                <FieldLabel htmlFor={`${formId}-field-13`} className="leading-snug">Page / Line Reference</FieldLabel>
                <Input id={`${formId}-field-13`}
                  placeholder="e.g. Page 3, Line 12"
                  value={evidenceDocReference}
                  onChange={(e) => setEvidenceDocReference(e.target.value)}
                  className="h-11 min-w-0 text-base sm:h-10 md:text-sm"
                />
              </Field>
            </FieldGroup>

            <Field className="min-w-0 gap-2">
              <FieldLabel htmlFor={`${formId}-field-14`} className="leading-snug">Follow-up / Internal Notes</FieldLabel>
              <Textarea id={`${formId}-field-14`}
                placeholder="Action items or remarks"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="min-h-24 min-w-0 resize-y text-base md:text-sm"
                rows={2}
              />
            </Field>

          </BillingDialogBody>
          <BillingDialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-auto min-h-11 whitespace-normal sm:min-h-9"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={responseMutation.isPending}
              className="h-auto min-h-11 whitespace-normal sm:min-h-9"
            >
              {responseMutation.isPending ? (
                <>
                  <ArrowsClockwise className="size-3.5 animate-spin motion-reduce:animate-none" />
                  Saving...
                </>
              ) : (
                "Save Payer Response"
              )}
            </Button>
          </BillingDialogFooter>
        </form>
      </BillingDialogContent>
    </Dialog>
  );
}
