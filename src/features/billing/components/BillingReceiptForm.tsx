import { useId, useRef, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldGroup, FieldLabel, FieldSet } from "@/components/ui/field";
import { billingQueryKeys } from "../hooks/queryKeys";
import { recordBillingReceipt, type ManualReceiptInput } from "../api/receipts";
import { billingDateTimeLocal, billingDateTimeToIso, manualReceiptSchema } from "../types/manual-records";

interface BillingReceiptFormProps {
  recordId: string;
  orgId: string;
  timezone: string;
  submittedAt?: string | null;
  onSavingChange: (saving: boolean) => void;
}

export function BillingReceiptForm({ recordId, orgId, timezone, submittedAt, onSavingChange }: BillingReceiptFormProps) {
  const formId = useId();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState("");
  const [receivedAt, setReceivedAt] = useState(() => billingDateTimeLocal(timezone));
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingReceipt, setPendingReceipt] = useState<ManualReceiptInput | null>(null);
  const submittingRef = useRef(false);

  async function saveReceipt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return;
    let receipt = pendingReceipt;
    try {
      if (!receipt) {
        const timestamp = billingDateTimeToIso(receivedAt, timezone);
        const parsed = manualReceiptSchema.safeParse({ request_id: crypto.randomUUID(), amount, received_at: timestamp, reference_number: reference || null, notes: notes || null });
        if (!parsed.success) {
          setError(parsed.error.issues[0]?.message || "Check the received amount and date.");
          return;
        }
        if (submittedAt && Date.parse(timestamp) < Date.parse(submittedAt)) {
          setError("The received date cannot be before this record was submitted.");
          return;
        }
        receipt = parsed.data;
      }
    } catch (validationError) {
      setError(validationError instanceof Error ? validationError.message : "Enter a valid date and time.");
      return;
    }

    submittingRef.current = true;
    setPendingReceipt(receipt);
    setSaving(true);
    onSavingChange(true);
    setError(null);
    try {
      await recordBillingReceipt(recordId, receipt);
      void queryClient.invalidateQueries({ queryKey: billingQueryKeys.all(orgId) });
      toast.success("Received amount added");
      setPendingReceipt(null);
      setAmount("");
      setReference("");
      setNotes("");
      setEditing(false);
    } catch (saveError) {
      const message = saveError && typeof saveError === "object" && "message" in saveError ? String(saveError.message) : "Could not confirm the received amount was saved.";
      setError(`${message} Retry to safely confirm this same receipt.`);
    } finally {
      submittingRef.current = false;
      setSaving(false);
      onSavingChange(false);
    }
  }

  if (!editing) {
    return <Button type="button" variant="outline" className="min-h-11 sm:min-h-9" onClick={() => { if (!pendingReceipt) setReceivedAt(billingDateTimeLocal(timezone)); setEditing(true); }}><Plus data-icon="inline-start" />{pendingReceipt ? "Resume receipt" : "Add received amount"}</Button>;
  }

  return (
    <form onSubmit={saveReceipt} className="flex flex-col gap-4 rounded-xl border bg-muted/20 p-4" aria-label="Add received amount">
      <p className="text-xs text-muted-foreground">Enter each amount when it arrives. Dates and times use {timezone}.</p>
      <FieldSet disabled={saving || !!pendingReceipt} className="min-w-0">
        <FieldGroup className="grid min-w-0 grid-cols-1 gap-4 @lg/billing-dialog:grid-cols-2">
        <Field className="min-w-0 gap-2"><FieldLabel htmlFor={`${formId}-amount`}>Amount received ($)</FieldLabel><Input id={`${formId}-amount`} type="text" inputMode="decimal" autoComplete="off" placeholder="0.00" value={amount} onChange={(event) => setAmount(event.target.value)} required className="min-h-11" /></Field>
        <Field className="min-w-0 gap-2"><FieldLabel htmlFor={`${formId}-received`}>Received date and time</FieldLabel><Input id={`${formId}-received`} type="datetime-local" value={receivedAt} onChange={(event) => setReceivedAt(event.target.value)} required className="min-h-11 min-w-0" /></Field>
        <Field className="min-w-0 gap-2 @lg/billing-dialog:col-span-2"><FieldLabel htmlFor={`${formId}-reference`}>Payment reference (optional)</FieldLabel><Input id={`${formId}-reference`} value={reference} maxLength={200} onChange={(event) => setReference(event.target.value)} className="min-h-11" /></Field>
        <Field className="min-w-0 gap-2 @lg/billing-dialog:col-span-2"><FieldLabel htmlFor={`${formId}-notes`}>Notes (optional)</FieldLabel><Textarea id={`${formId}-notes`} value={notes} maxLength={5000} onChange={(event) => setNotes(event.target.value)} /></Field>
        </FieldGroup>
      </FieldSet>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex flex-wrap gap-2"><Button type="submit" disabled={saving} className="min-h-11 sm:min-h-9">{saving ? "Saving…" : pendingReceipt ? "Retry receipt" : "Save received amount"}</Button><Button type="button" variant="ghost" disabled={saving} onClick={() => setEditing(false)} className="min-h-11 sm:min-h-9">{pendingReceipt ? "Hide" : "Cancel"}</Button></div>
    </form>
  );
}
