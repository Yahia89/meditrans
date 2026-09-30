import { useId, useRef, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/lib/supabase";
import { getTimezoneLabel } from "@/lib/timezone";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useCreateManualBillingRecord } from "../hooks/useManualBillingRecord";
import { billingQueryKeys } from "../hooks/queryKeys";
import { uploadBillingFiles } from "../api/documents";
import { readBillingRows } from "../api/pagination";
import { billingDateTimeLocal, manualBillingFormSchema, patientBillingReference, type ManualBillingRecordInput } from "../types/manual-records";
import { BillingFilesPicker } from "./BillingFilesPicker";
import { BillingDialogContent, BillingDialogHeader, BillingDialogBody, BillingDialogFooter } from "./BillingDialogLayout";

interface AddBillingRecordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddBillingRecordDialog({ open, onOpenChange }: AddBillingRecordDialogProps) {
  const { currentOrganization } = useOrganization();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && currentOrganization ? (
        <AddBillingRecordForm
          key={currentOrganization.id}
          orgId={currentOrganization.id}
          timezone={currentOrganization.timezone || "America/Chicago"}
          onClose={() => onOpenChange(false)}
        />
      ) : null}
    </Dialog>
  );
}

function AddBillingRecordForm({ orgId, timezone, onClose }: { orgId: string; timezone: string; onClose: () => void }) {
  const formId = useId();
  const queryClient = useQueryClient();
  const createMutation = useCreateManualBillingRecord(orgId);
  const submissionLock = useRef(false);
  const [requestId] = useState(() => crypto.randomUUID());
  const [values, setValues] = useState(() => ({
    client_id: "",
    agency_name: "",
    submitted_amount: "",
    submitted_at: billingDateTimeLocal(timezone),
    received_amount: "",
    received_at: "",
    external_reference: "",
    notes: "",
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<File[]>([]);
  const [savedRecordId, setSavedRecordId] = useState<string | null>(null);
  const [pendingRecord, setPendingRecord] = useState<ManualBillingRecordInput | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const { data: patients = [], isPending: patientsLoading, isError: patientsFailed, refetch: reloadPatients } = useQuery({
    queryKey: ["billing", orgId, "patients"],
    queryFn: async () => {
      return readBillingRows(supabase.from("patients")
        .select("id, full_name")
        .eq("org_id", orgId)
        .eq("disabled", false)
        .order("full_name", { ascending: true })
        .order("id", { ascending: true }));
    },
  });

  function setField(field: keyof typeof values, value: string) {
    setValues((previous) => ({ ...previous, [field]: value }));
    setErrors((previous) => ({ ...previous, [field]: "" }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submissionLock.current) return;
    const parsed = manualBillingFormSchema(timezone).safeParse({ ...values, request_id: requestId });
    if (!savedRecordId && !pendingRecord && !parsed.success) {
      const nextErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const field = String(issue.path[0]);
        nextErrors[field] ??= issue.message;
      }
      setErrors(nextErrors);
      const firstInvalid = document.getElementById(`${formId}-${Object.keys(nextErrors)[0]}`);
      firstInvalid?.focus({ preventScroll: true });
      firstInvalid?.scrollIntoView({ block: "nearest" });
      return;
    }

    submissionLock.current = true;
    setIsSaving(true);
    setUploadError(null);
    setSaveError(null);
    let recordId = savedRecordId;
    try {
      const input = pendingRecord ?? (parsed.success ? parsed.data : null);
      if (!recordId && input) {
        setPendingRecord(input);
        const record = await createMutation.mutateAsync(input);
        recordId = record.id;
        setSavedRecordId(record.id);
      }
      if (!recordId) throw new Error("Billing record could not be saved");
      if (files.length > 0) {
        const result = await uploadBillingFiles({ orgId, recordId, files, documentType: "claim_copy" });
        setFiles(result.failedFiles);
        void queryClient.invalidateQueries({ queryKey: billingQueryKeys.all(orgId) });
        if (result.failedFiles.length > 0) {
          setUploadError(`${result.failedFiles.length} file(s) could not be uploaded. Retry below, or add them from the record later.`);
          toast.warning("Billing record saved. Some files still need to be uploaded.");
          return;
        }
      }
      toast.success("Billing record saved");
      onClose();
    } catch (error) {
      const message = error && typeof error === "object" && "message" in error && typeof error.message === "string"
        ? error.message
        : "Please try again";
      if (recordId) {
        setUploadError("Your billing record is saved. Retry uploading the files, or add them from the record later.");
        toast.error(`File upload failed: ${message}`);
      } else {
        setSaveError(`${message}. Retry to confirm this same billing record.`);
        toast.error(`Could not save billing record: ${message}`);
      }
    } finally {
      submissionLock.current = false;
      setIsSaving(false);
    }
  }

  return (
    <BillingDialogContent
      className="sm:max-w-2xl"
      showCloseButton={!isSaving}
      onEscapeKeyDown={(event) => { if (isSaving) event.preventDefault(); }}
      onPointerDownOutside={(event) => { if (isSaving) event.preventDefault(); }}
      onInteractOutside={(event) => { if (isSaving) event.preventDefault(); }}
    >
      <BillingDialogHeader>
        <DialogTitle>Add billing record</DialogTitle>
        <DialogDescription>Track what you submitted to an agency and any payment received.</DialogDescription>
      </BillingDialogHeader>
      <form id={formId} onSubmit={handleSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
        <BillingDialogBody>
          {savedRecordId ? (
            <Alert>
              <AlertTitle>Billing record saved</AlertTitle>
              <AlertDescription>{uploadError || "You can finish attaching files below."}</AlertDescription>
            </Alert>
          ) : null}
          {saveError ? <Alert variant="destructive"><AlertTitle>Save not confirmed</AlertTitle><AlertDescription>{saveError}</AlertDescription></Alert> : null}
          <FieldSet disabled={isSaving || !!pendingRecord || !!savedRecordId} className="min-w-0 gap-5 [&_input]:h-11 sm:[&_input]:h-10">
            <FieldLegend className="sr-only">Billing submission</FieldLegend>
            <FieldGroup className="grid min-w-0 grid-cols-1 gap-4 @lg/billing-dialog:grid-cols-2">
              <Field data-invalid={!!errors.client_id} className="min-w-0 gap-2">
                <FieldLabel htmlFor={`${formId}-client_id`}>Patient *</FieldLabel>
                <Select value={values.client_id} onValueChange={(value) => setField("client_id", value)} disabled={isSaving || !!pendingRecord || !!savedRecordId || patientsLoading || patientsFailed}>
                  <SelectTrigger id={`${formId}-client_id`} aria-invalid={!!errors.client_id} aria-describedby={errors.client_id ? `${formId}-client-error` : undefined} className="w-full min-w-0 text-base md:text-sm data-[size=default]:h-11 sm:data-[size=default]:h-10 [&_[data-slot=select-value]]:min-w-0 [&_[data-slot=select-value]]:truncate">
                    <SelectValue placeholder={patientsLoading ? "Loading patients…" : "Select patient"} />
                  </SelectTrigger>
                  <SelectContent position="popper" className="billing-surface w-[var(--radix-select-trigger-width)] max-w-[calc(100vw-2rem)]">
                    <SelectGroup>
                      {patients.map((patient) => <SelectItem key={patient.id} value={patient.id}>{patient.full_name} · {patientBillingReference(patient.id)}</SelectItem>)}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                {patientsFailed ? <FieldError>Patients could not be loaded. <Button type="button" variant="link" size="sm" onClick={() => void reloadPatients()}>Retry</Button></FieldError> : null}
                {!patientsLoading && !patientsFailed && patients.length === 0 ? <FieldDescription>Add a patient before creating a billing record.</FieldDescription> : null}
                <FieldError id={`${formId}-client-error`}>{errors.client_id}</FieldError>
              </Field>
              <Field className="min-w-0 gap-2">
                <FieldLabel htmlFor={`${formId}-internal-reference`}>Internal reference</FieldLabel>
                <Input id={`${formId}-internal-reference`} value={patientBillingReference(values.client_id)} readOnly placeholder="Select a patient first" aria-describedby={`${formId}-reference-help`} />
                <FieldDescription id={`${formId}-reference-help`}>First section of the patient’s ID.</FieldDescription>
              </Field>
            </FieldGroup>
            <Field data-invalid={!!errors.agency_name} className="min-w-0 gap-2">
              <FieldLabel htmlFor={`${formId}-agency_name`}>Agency *</FieldLabel>
              <Input id={`${formId}-agency_name`} value={values.agency_name} onChange={(event) => setField("agency_name", event.target.value)} placeholder="Agency you submitted to" maxLength={200} aria-invalid={!!errors.agency_name} aria-describedby={errors.agency_name ? `${formId}-agency-error` : undefined} />
              <FieldError id={`${formId}-agency-error`}>{errors.agency_name}</FieldError>
            </Field>
            <FieldGroup className="grid min-w-0 grid-cols-1 gap-4 @lg/billing-dialog:grid-cols-2">
              <Field data-invalid={!!errors.submitted_amount} className="min-w-0 gap-2">
                <FieldLabel htmlFor={`${formId}-submitted_amount`}>Original submitted amount ($) *</FieldLabel>
                <Input id={`${formId}-submitted_amount`} inputMode="decimal" value={values.submitted_amount} onChange={(event) => setField("submitted_amount", event.target.value)} placeholder="0.00" aria-invalid={!!errors.submitted_amount} aria-describedby={errors.submitted_amount ? `${formId}-amount-error` : undefined} />
                <FieldError id={`${formId}-amount-error`}>{errors.submitted_amount}</FieldError>
              </Field>
              <Field data-invalid={!!errors.submitted_at} className="min-w-0 gap-2">
                <FieldLabel htmlFor={`${formId}-submitted_at`}>Submitted date &amp; time *</FieldLabel>
                <Input id={`${formId}-submitted_at`} type="datetime-local" value={values.submitted_at} onChange={(event) => setField("submitted_at", event.target.value)} aria-invalid={!!errors.submitted_at} aria-describedby={errors.submitted_at ? `${formId}-submitted-error` : `${formId}-timezone`} />
                <FieldDescription id={`${formId}-timezone`}>{getTimezoneLabel(timezone)}</FieldDescription>
                <FieldError id={`${formId}-submitted-error`}>{errors.submitted_at}</FieldError>
              </Field>
              <Field data-invalid={!!errors.received_amount} className="min-w-0 gap-2">
                <FieldLabel htmlFor={`${formId}-received_amount`}>Amount received ($)</FieldLabel>
                <Input id={`${formId}-received_amount`} inputMode="decimal" value={values.received_amount} onChange={(event) => setField("received_amount", event.target.value)} placeholder="Leave blank if unpaid" aria-invalid={!!errors.received_amount} aria-describedby={errors.received_amount ? `${formId}-received-amount-error` : undefined} />
                <FieldError id={`${formId}-received-amount-error`}>{errors.received_amount}</FieldError>
              </Field>
              <Field data-invalid={!!errors.received_at} className="min-w-0 gap-2">
                <FieldLabel htmlFor={`${formId}-received_at`}>Received date &amp; time</FieldLabel>
                <Input id={`${formId}-received_at`} type="datetime-local" value={values.received_at} onChange={(event) => setField("received_at", event.target.value)} aria-invalid={!!errors.received_at} aria-describedby={errors.received_at ? `${formId}-received-error` : `${formId}-received-timezone`} />
                <FieldDescription id={`${formId}-received-timezone`}>{getTimezoneLabel(timezone)}</FieldDescription>
                <FieldError id={`${formId}-received-error`}>{errors.received_at}</FieldError>
              </Field>
            </FieldGroup>
            <Field className="min-w-0 gap-2">
              <FieldLabel htmlFor={`${formId}-external_reference`}>Agency reference</FieldLabel>
              <Input id={`${formId}-external_reference`} value={values.external_reference} onChange={(event) => setField("external_reference", event.target.value)} maxLength={200} placeholder="Optional reference from the agency" />
            </Field>
            <Field className="min-w-0 gap-2">
              <FieldLabel htmlFor={`${formId}-notes`}>Notes</FieldLabel>
              <Textarea id={`${formId}-notes`} value={values.notes} onChange={(event) => setField("notes", event.target.value)} maxLength={5000} rows={2} placeholder="Optional billing or payment notes" />
            </Field>
          </FieldSet>
          <BillingFilesPicker files={files} onFilesChange={setFiles} disabled={isSaving} />
        </BillingDialogBody>
        <BillingDialogFooter>
          <Button type="button" variant="outline" disabled={isSaving} onClick={onClose}>{savedRecordId ? "Done" : "Cancel"}</Button>
          <Button type="submit" disabled={isSaving || (!savedRecordId && !pendingRecord && (patientsLoading || patientsFailed || patients.length === 0))}>
            {isSaving ? <LoaderCircle data-icon="inline-start" className="animate-spin motion-reduce:animate-none" /> : null}
            {isSaving ? "Saving…" : savedRecordId ? "Upload files" : pendingRecord ? "Retry save" : "Add billing record"}
          </Button>
        </BillingDialogFooter>
      </form>
    </BillingDialogContent>
  );
}
