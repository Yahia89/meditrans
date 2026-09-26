import { BillingDialogContent, BillingDialogHeader, BillingDialogBody, BillingDialogFooter } from "./BillingDialogLayout";
import { useId, useState, type FormEvent } from "react";
import {
  Dialog,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PaperPlaneTilt, Info, ArrowsClockwise } from "@phosphor-icons/react";
import { useRecordExternalSubmission } from "../hooks/useBillingRecords";
import type { SubmissionChannel } from "../types/billing";
import { recordSubmissionSchema } from "../types/schemas";
import { toast } from "sonner";

interface RecordSubmissionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recordId: string;
  internalReference: string;
}

export function RecordSubmissionDialog({
  open,
  onOpenChange,
  recordId,
  internalReference,
}: RecordSubmissionDialogProps) {
  const formId = useId();
  const [occurredAt, setOccurredAt] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [submissionChannel, setSubmissionChannel] = useState<SubmissionChannel>("mn_its_dde");
  const [externalReference, setExternalReference] = useState<string>("");
  const [submittedByName, setSubmittedByName] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  const submitMutation = useRecordExternalSubmission();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!occurredAt) {
      toast.error("Please specify the actual external submission date");
      return;
    }

    try {
      await submitMutation.mutateAsync({
        recordId,
        input: {
          occurred_at: `${occurredAt}T12:00:00Z`,
          submission_channel: submissionChannel,
          submitted_by_name: submittedByName.trim() || undefined,
          external_reference: externalReference.trim() || undefined,
          purpose: "original",
          notes: notes.trim() || undefined,
        },
      });
      onOpenChange(false);
    } catch (err: unknown) {
      console.error("Failed to record submission:", err instanceof Error ? err.message : err);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <BillingDialogContent className="max-w-md">
        <BillingDialogHeader>
          <DialogTitle className="flex items-start gap-2 text-lg leading-snug [&_svg]:shrink-0">
            <PaperPlaneTilt size={20} weight="bold" className="text-primary" />
            Record External Submission
          </DialogTitle>
          <DialogDescription className="leading-relaxed">
            For record: <span className="font-bold text-foreground">{internalReference}</span>
          </DialogDescription>
        </BillingDialogHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <BillingDialogBody>
            <Alert>
              <Info aria-hidden="true" />
              <AlertDescription>
                This records a submission already made outside this system. It does not send anything to the payer.
              </AlertDescription>
            </Alert>
            <Field className="min-w-0 gap-2">
              <FieldLabel htmlFor={`${formId}-field-1`} className="leading-snug">
                Actual External Submission Date *
              </FieldLabel>
              <Input id={`${formId}-field-1`}
                type="date"
                value={occurredAt}
                onChange={(e) => setOccurredAt(e.target.value)}
                className="h-11 min-w-0 text-base sm:h-10 md:text-sm"
                required
              />
            </Field>

            <Field className="min-w-0 gap-2">
              <FieldLabel htmlFor={`${formId}-field-2`} className="leading-snug">Submission Channel *</FieldLabel>
              <Select
                value={submissionChannel}
                onValueChange={(value) => {
                  const result = recordSubmissionSchema.shape.submission_channel.safeParse(value);
                  if (result.success) setSubmissionChannel(result.data);
                }}
              >
                <SelectTrigger id={`${formId}-field-2`} className="w-full min-w-0 text-base data-[size=default]:h-11 sm:data-[size=default]:h-10 md:text-sm [&_[data-slot=select-value]]:min-w-0 [&_[data-slot=select-value]]:truncate">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper" className="billing-surface w-[var(--radix-select-trigger-width)] max-w-[calc(100vw-2rem)] [&_[data-slot=select-item]]:whitespace-normal [&_[data-slot=select-item]]:break-words">
                  <SelectGroup>
                    <SelectItem value="mn_its_dde">MN-ITS DDE Portal</SelectItem>
                    <SelectItem value="partner_portal">Partner Web Portal</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="mail">Mail / Paper</SelectItem>
                    <SelectItem value="fax">Fax</SelectItem>
                    <SelectItem value="clearinghouse">Clearinghouse</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>

            <Field className="min-w-0 gap-2">
              <FieldLabel htmlFor={`${formId}-field-3`} className="leading-snug">
                External Reference / Claim Control #
              </FieldLabel>
              <Input id={`${formId}-field-3`}
                placeholder="e.g. 20260715-44219"
                value={externalReference}
                onChange={(e) => setExternalReference(e.target.value)}
                className="h-11 min-w-0 text-base sm:h-10 md:text-sm font-mono"
              />
            </Field>

            <Field className="min-w-0 gap-2">
              <FieldLabel htmlFor={`${formId}-field-4`} className="leading-snug">Submitted By (Staff Name)</FieldLabel>
              <Input id={`${formId}-field-4`}
                placeholder="Staff member who submitted externally"
                value={submittedByName}
                onChange={(e) => setSubmittedByName(e.target.value)}
                className="h-11 min-w-0 text-base sm:h-10 md:text-sm"
              />
            </Field>

            <Field className="min-w-0 gap-2">
              <FieldLabel htmlFor={`${formId}-field-5`} className="leading-snug">Submission Notes</FieldLabel>
              <Textarea id={`${formId}-field-5`}
                placeholder="Optional notes or confirmations"
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
              disabled={submitMutation.isPending}
              className="h-auto min-h-11 whitespace-normal sm:min-h-9"
            >
              {submitMutation.isPending ? (
                <>
                  <ArrowsClockwise className="size-3.5 animate-spin motion-reduce:animate-none" />
                  Recording...
                </>
              ) : (
                "Confirm External Submission"
              )}
            </Button>
          </BillingDialogFooter>
        </form>
      </BillingDialogContent>
    </Dialog>
  );
}
