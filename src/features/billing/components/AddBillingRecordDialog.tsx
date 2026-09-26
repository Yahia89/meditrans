import { BillingDialogContent, BillingDialogHeader, BillingDialogBody, BillingDialogFooter } from "./BillingDialogLayout";
import { useId, useState, useMemo, type FormEvent } from "react";
import {
  Dialog,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Plus,
  Trash,
  FileText,
  ArrowsClockwise,
} from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useBillingPayers } from "../hooks/useBillingPayers";
import { useCreateBillingRecord } from "../hooks/useBillingRecords";
import { addRecordSchema, billingLineSchema, recordSubmissionSchema } from "../types/schemas";
import type {
  BillingRecordType,
  SubmissionChannel,
  UnitType,
  TripComponent,
} from "../types/billing";
import { multiplyQtyRate, addMoney, formatMoney } from "../utils/decimal";
import { toast } from "sonner";

interface LineDraft {
  clientId: string;
  serviceDate: string;
  description: string;
  hcpcsCode: string;
  modifiers: string;
  quantity: string;
  unitType: UnitType;
  unitRate: string;
  billedAmount: string;
  tripId?: string;
  tripComponent?: TripComponent;
  notes?: string;
}

interface AddBillingRecordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultRecordType?: BillingRecordType;
}

export function AddBillingRecordDialog({
  open,
  onOpenChange,
  defaultRecordType = "dhs_claim",
}: AddBillingRecordDialogProps) {
  const formId = useId();
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;

  const { data: payers = [] } = useBillingPayers();
  const createMutation = useCreateBillingRecord();

  // Form State
  const [recordType, setRecordType] = useState<BillingRecordType>(defaultRecordType);
  const [payerId, setPayerId] = useState<string>("");
  const [internalRef, setInternalRef] = useState<string>("");
  const [clientId, setClientId] = useState<string>("");
  const [periodStart, setPeriodStart] = useState<string>(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10)
  );
  const [periodEnd, setPeriodEnd] = useState<string>(
    new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().slice(0, 10)
  );
  const [dueDate, setDueDate] = useState<string>("");

  // Mode: Already Submitted vs Internal Draft
  const [isSubmittedExternally, setIsSubmittedExternally] = useState<boolean>(false);
  const [externalSubmittedAt, setExternalSubmittedAt] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [submissionChannel, setSubmissionChannel] = useState<SubmissionChannel>("mn_its_dde");
  const [externalReference, setExternalReference] = useState<string>("");
  const [submittedByName, setSubmittedByName] = useState<string>("");

  // Additional fields
  const [isHistorical, setIsHistorical] = useState<boolean>(false);
  const [nextFollowUpDate, setNextFollowUpDate] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  // Lines
  const [lines, setLines] = useState<LineDraft[]>([
    {
      clientId: "",
      serviceDate: new Date().toISOString().slice(0, 10),
      description: "One-Way Medical Transport",
      hcpcsCode: "A0130",
      modifiers: "",
      quantity: "1.00",
      unitType: "one_way_trips",
      unitRate: "25.00",
      billedAmount: "25.00",
    },
  ]);

  // Query Patients
  const { data: patients = [] } = useQuery({
    queryKey: ["patients", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patients")
        .select("id, full_name, medicaid_id")
        .eq("org_id", orgId)
        .eq("disabled", false)
        .order("full_name", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!orgId && open,
  });

  // Query Completed Trips for selected client (optional trip linking)
  const { data: clientTrips = [] } = useQuery({
    queryKey: ["client-completed-trips", orgId, clientId],
    queryFn: async () => {
      if (!clientId) return [];
      const { data, error } = await supabase
        .from("trips")
        .select("id, pickup_time, pickup_address, dropoff_address, distance_miles")
        .eq("org_id", orgId)
        .eq("patient_id", clientId)
        .eq("status", "completed")
        .order("pickup_time", { ascending: false })
        .limit(30);
      if (error) return [];
      return data || [];
    },
    enabled: !!orgId && !!clientId && open,
  });

  // Calculate total billed from lines
  const totalBilled = useMemo(() => {
    let sum = "0.00";
    for (const l of lines) {
      sum = addMoney(sum, l.billedAmount || "0.00");
    }
    return sum;
  }, [lines]);

  // Handlers for Lines
  const handleAddLine = () => {
    setLines((prev) => [
      ...prev,
      {
        clientId: clientId || (patients[0]?.id ?? ""),
        serviceDate: periodStart || new Date().toISOString().slice(0, 10),
        description: "Mileage Transport",
        hcpcsCode: "S0209",
        modifiers: "",
        quantity: "10.00",
        unitType: "miles",
        unitRate: "1.75",
        billedAmount: "17.50",
      },
    ]);
  };

  const handleRemoveLine = (index: number) => {
    if (lines.length <= 1) {
      toast.error("A billing record must have at least one service line");
      return;
    }
    setLines((prev) => prev.filter((_, i) => i !== index));
  };

  const handleLineChange = <Field extends keyof LineDraft>(
    index: number,
    field: Field,
    value: LineDraft[Field]
  ) => {
    setLines((prev) => {
      const updated = [...prev];
      const target = { ...updated[index], [field]: value };

      // Auto-recalculate billedAmount when qty or rate changes
      if (field === "quantity" || field === "unitRate") {
        if (target.quantity && target.unitRate) {
          target.billedAmount = multiplyQtyRate(target.quantity, target.unitRate);
        }
      }
      updated[index] = target;
      return updated;
    });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!payerId) {
      toast.error("Please select a payer");
      return;
    }

    if (recordType === "dhs_claim" && !clientId) {
      toast.error("DHS direct claims must have an assigned client");
      return;
    }

    if (isSubmittedExternally && !externalSubmittedAt) {
      toast.error("Please provide the actual external submission date");
      return;
    }

    // Verify all lines have a valid client
    for (let i = 0; i < lines.length; i++) {
      const lineClient = lines[i].clientId || clientId;
      if (!lineClient) {
        toast.error(`Service line #${i + 1} is missing a client assignment`);
        return;
      }
    }

    try {
      const result = addRecordSchema.safeParse({
        record_type: recordType,
        payer_id: payerId,
        internal_reference: internalRef.trim() || undefined,
        client_id: clientId || undefined,
        billing_period_start: periodStart,
        billing_period_end: periodEnd,
        due_date: dueDate || undefined,
        submission_status: isSubmittedExternally ? "submitted" : "draft",
        external_submitted_at: isSubmittedExternally ? `${externalSubmittedAt}T12:00:00Z` : undefined,
        submission_channel: isSubmittedExternally ? submissionChannel : undefined,
        submitted_by_name: submittedByName.trim() || undefined,
        original_external_reference: externalReference.trim() || undefined,
        is_historical: isHistorical,
        next_follow_up_date: nextFollowUpDate || undefined,
        notes: notes.trim() || undefined,
        lines: lines.map((l) => ({
          client_id: l.clientId || clientId,
          service_date: l.serviceDate,
          description: l.description,
          hcpcs_code: l.hcpcsCode.trim() || null,
          modifiers: l.modifiers
            ? l.modifiers
              .split(",")
              .map((m) => m.trim())
              .filter(Boolean)
            : null,
          quantity: l.quantity,
          unit_type: l.unitType,
          unit_rate: l.unitRate || null,
          billed_amount: l.billedAmount,
          trip_id: l.tripId || null,
          trip_component: l.tripComponent || null,
          notes: l.notes || null,
        })),
      });

      if (!result.success) {
        toast.error(result.error.issues[0]?.message ?? "Please check the billing record fields");
        return;
      }

      await createMutation.mutateAsync(result.data);

      onOpenChange(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create billing record";
      console.error("Submission failed:", msg);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <BillingDialogContent className="max-w-4xl">
        <BillingDialogHeader>
          <DialogTitle className="flex items-start gap-2 text-lg leading-snug [&_svg]:shrink-0">
            <FileText size={22} weight="bold" className="text-[#3D5A3D]" />
            Add Billing Record
          </DialogTitle>
          <DialogDescription className="leading-relaxed">
            Record manual DHS claims or partner invoices. Submissions happen outside this CRM.
          </DialogDescription>
        </BillingDialogHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <BillingDialogBody>
            {/* 1. Header Information */}
            <FieldGroup className="grid min-w-0 grid-cols-1 gap-4 @lg/billing-dialog:grid-cols-2">
              {/* Record Type */}
              <Field className="min-w-0 gap-2">
                <FieldLabel htmlFor={`${formId}-field-1`} className="leading-snug">Record Type</FieldLabel>
                <Select
                  value={recordType}
                  onValueChange={(value) => {
                    const result = addRecordSchema.shape.record_type.safeParse(value);
                    if (result.success) setRecordType(result.data);
                  }}
                >
                  <SelectTrigger id={`${formId}-field-1`} className="w-full min-w-0 text-base data-[size=default]:h-11 sm:data-[size=default]:h-10 md:text-sm [&_[data-slot=select-value]]:min-w-0 [&_[data-slot=select-value]]:truncate">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper" className="billing-surface w-[var(--radix-select-trigger-width)] max-w-[calc(100vw-2rem)] [&_[data-slot=select-item]]:whitespace-normal [&_[data-slot=select-item]]:break-words">
                    <SelectGroup>
                      <SelectItem value="dhs_claim">DHS / MHCP Direct Claim</SelectItem>
                      <SelectItem value="partner_invoice">Partner Invoice (e.g. Connectivity)</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>

              {/* Payer */}
              <Field className="min-w-0 gap-2">
                <FieldLabel htmlFor={`${formId}-field-2`} className="leading-snug">Bill-to Payer *</FieldLabel>
                <Select value={payerId} onValueChange={setPayerId}>
                  <SelectTrigger id={`${formId}-field-2`} className="w-full min-w-0 text-base data-[size=default]:h-11 sm:data-[size=default]:h-10 md:text-sm [&_[data-slot=select-value]]:min-w-0 [&_[data-slot=select-value]]:truncate">
                    <SelectValue placeholder="Select Payer" />
                  </SelectTrigger>
                  <SelectContent position="popper" className="billing-surface w-[var(--radix-select-trigger-width)] max-w-[calc(100vw-2rem)] [&_[data-slot=select-item]]:whitespace-normal [&_[data-slot=select-item]]:break-words">
                    <SelectGroup>
                      {payers.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} ({p.payer_type.replace(/_/g, " ")})
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>

              {/* Client (Required for DHS, optional for Multi-client Partner Invoice) */}
              <Field className="min-w-0 gap-2">
                <FieldLabel htmlFor={`${formId}-field-3`} className="leading-snug">
                  {recordType === "dhs_claim" ? "Client (Patient) *" : "Primary Client (Optional)"}
                </FieldLabel>
                <Select value={clientId} onValueChange={setClientId}>
                  <SelectTrigger id={`${formId}-field-3`} className="w-full min-w-0 text-base data-[size=default]:h-11 sm:data-[size=default]:h-10 md:text-sm [&_[data-slot=select-value]]:min-w-0 [&_[data-slot=select-value]]:truncate">
                    <SelectValue placeholder={recordType === "dhs_claim" ? "Select Client" : "Multiple / General"} />
                  </SelectTrigger>
                  <SelectContent position="popper" className="billing-surface w-[var(--radix-select-trigger-width)] max-w-[calc(100vw-2rem)] [&_[data-slot=select-item]]:whitespace-normal [&_[data-slot=select-item]]:break-words">
                    <SelectGroup>
                      {patients.map((pt) => (
                        <SelectItem key={pt.id} value={pt.id}>
                          {pt.full_name} {pt.medicaid_id ? `(${pt.medicaid_id})` : ""}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            </FieldGroup>

            <FieldGroup className="grid min-w-0 grid-cols-1 gap-4 @lg/billing-dialog:grid-cols-2">
              {/* Period Start */}
              <Field className="min-w-0 gap-2">
                <FieldLabel htmlFor={`${formId}-field-4`} className="leading-snug">Service Period Start *</FieldLabel>
                <Input id={`${formId}-field-4`}
                  type="date"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                  className="h-11 min-w-0 text-base sm:h-10 md:text-sm"
                  required
                />
              </Field>

              {/* Period End */}
              <Field className="min-w-0 gap-2">
                <FieldLabel htmlFor={`${formId}-field-5`} className="leading-snug">Service Period End *</FieldLabel>
                <Input id={`${formId}-field-5`}
                  type="date"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                  className="h-11 min-w-0 text-base sm:h-10 md:text-sm"
                  required
                />
              </Field>

              {/* Payment Due Date */}
              <Field className="min-w-0 gap-2">
                <FieldLabel htmlFor={`${formId}-field-6`} className="leading-snug">Payment Due Date</FieldLabel>
                <Input id={`${formId}-field-6`}
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="h-11 min-w-0 text-base sm:h-10 md:text-sm"
                />
              </Field>

              {/* Custom Internal Ref */}
              <Field className="min-w-0 gap-2">
                <FieldLabel htmlFor={`${formId}-field-7`} className="leading-snug">Internal Reference</FieldLabel>
                <Input id={`${formId}-field-7`}
                  placeholder="Auto-generated if empty"
                  value={internalRef}
                  onChange={(e) => setInternalRef(e.target.value)}
                  className="h-11 min-w-0 text-base sm:h-10 md:text-sm font-mono"
                />
              </Field>
            </FieldGroup>

            {/* 2. External Submission Mode Toggle */}
            <FieldSet className="min-w-0 gap-4 rounded-xl border bg-muted/40 p-4">
              <FieldLegend className="sr-only">Submission history</FieldLegend>
              <div className="flex items-start justify-between gap-4">
                <div className="flex flex-col gap-0.5">
                  <FieldLabel htmlFor={`${formId}-submitted-externally`}>
                    Record Billing Already Submitted Externally
                  </FieldLabel>
                  <p className="text-xs text-muted-foreground">
                    Enable if this claim/invoice was already entered into MN-ITS or sent to the partner.
                  </p>
                </div>
                <Switch
                  id={`${formId}-submitted-externally`}
                  className="mt-1 shrink-0"
                  checked={isSubmittedExternally}
                  onCheckedChange={setIsSubmittedExternally}
                />
              </div>

              {isSubmittedExternally && (
                <FieldGroup className="grid min-w-0 grid-cols-1 gap-4 @lg/billing-dialog:grid-cols-2">
                  <Field className="min-w-0 gap-2">
                    <FieldLabel htmlFor={`${formId}-field-8`} className="leading-snug">
                      Actual External Submission Date *
                    </FieldLabel>
                    <Input id={`${formId}-field-8`}
                      type="date"
                      value={externalSubmittedAt}
                      onChange={(e) => setExternalSubmittedAt(e.target.value)}
                      className="h-11 min-w-0 text-base sm:h-10 md:text-sm"
                      required={isSubmittedExternally}
                    />
                  </Field>

                  <Field className="min-w-0 gap-2">
                    <FieldLabel htmlFor={`${formId}-field-9`} className="leading-snug">Submission Channel</FieldLabel>
                    <Select
                      value={submissionChannel}
                      onValueChange={(value) => {
                        const result = recordSubmissionSchema.shape.submission_channel.safeParse(value);
                        if (result.success) setSubmissionChannel(result.data);
                      }}
                    >
                      <SelectTrigger id={`${formId}-field-9`} className="w-full min-w-0 text-base data-[size=default]:h-11 sm:data-[size=default]:h-10 md:text-sm [&_[data-slot=select-value]]:min-w-0 [&_[data-slot=select-value]]:truncate">
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
                    <FieldLabel htmlFor={`${formId}-field-10`} className="leading-snug">
                      External Reference # / Claim Control #
                    </FieldLabel>
                    <Input id={`${formId}-field-10`}
                      placeholder="e.g. 20260701-098872"
                      value={externalReference}
                      onChange={(e) => setExternalReference(e.target.value)}
                      className="h-11 min-w-0 text-base sm:h-10 md:text-sm font-mono"
                    />
                  </Field>

                  <Field className="min-w-0 gap-2">
                    <FieldLabel htmlFor={`${formId}-field-11`} className="leading-snug">Submitted By (Staff)</FieldLabel>
                    <Input id={`${formId}-field-11`}
                      placeholder="Staff submitter name"
                      value={submittedByName}
                      onChange={(e) => setSubmittedByName(e.target.value)}
                      className="h-11 min-w-0 text-base sm:h-10 md:text-sm"
                    />
                  </Field>
                </FieldGroup>
              )}

              <Field orientation="horizontal" className="min-h-11 min-w-0 items-start gap-3 pt-3">
                <Checkbox
                  id={`${formId}-historical`}
                  checked={isHistorical}
                  onCheckedChange={(checked) => setIsHistorical(checked === true)}
                  className="mt-0.5"
                />
                <FieldLabel htmlFor={`${formId}-historical`} className="leading-snug cursor-pointer">
                  Historical record backfill (prior system migration or legacy data)
                </FieldLabel>
              </Field>
            </FieldSet>

            {/* 3. Service Lines Section */}
            <div className="flex flex-col gap-3">
              <div className="flex flex-col items-start gap-3 @lg/billing-dialog:flex-row @lg/billing-dialog:items-center @lg/billing-dialog:justify-between">
                <div>
                  <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
                    Service Lines ({lines.length})
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Each service line is attributable to a specific client and date.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddLine}
                  className="h-auto min-h-11 whitespace-normal sm:min-h-9"
                >
                  <Plus size={14} weight="bold" />
                  Add Service Line
                </Button>
              </div>

              <div className="flex flex-col gap-3">
                {lines.map((line, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 bg-background border border-border rounded-xl flex flex-col gap-3 text-xs shadow-2xs"
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-border">
                      <span className="font-bold text-foreground text-xs">
                        Line #{idx + 1}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveLine(idx)}
                        aria-label={`Remove service line ${idx + 1}`}
                        disabled={lines.length <= 1}
                        className="size-11 shrink-0 p-0 sm:size-9"
                      >
                        <Trash size={14} />
                      </Button>
                    </div>

                    <FieldGroup className="grid min-w-0 grid-cols-1 gap-4 @lg/billing-dialog:grid-cols-2">
                      {/* Line Client */}
                      <Field className="min-w-0 gap-2">
                        <FieldLabel htmlFor={`${formId}-field-12-${idx}`} className="leading-snug">Client</FieldLabel>
                        <Select
                          value={line.clientId || clientId}
                          onValueChange={(val) => handleLineChange(idx, "clientId", val)}
                        >
                          <SelectTrigger id={`${formId}-field-12-${idx}`} className="w-full min-w-0 text-base data-[size=default]:h-11 sm:data-[size=default]:h-10 md:text-sm [&_[data-slot=select-value]]:min-w-0 [&_[data-slot=select-value]]:truncate">
                            <SelectValue placeholder="Select Client" />
                          </SelectTrigger>
                          <SelectContent position="popper" className="billing-surface w-[var(--radix-select-trigger-width)] max-w-[calc(100vw-2rem)] [&_[data-slot=select-item]]:whitespace-normal [&_[data-slot=select-item]]:break-words">
                            <SelectGroup>
                              {patients.map((pt) => (
                                <SelectItem key={pt.id} value={pt.id}>
                                  {pt.full_name}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      </Field>

                      {/* Service Date */}
                      <Field className="min-w-0 gap-2">
                        <FieldLabel htmlFor={`${formId}-field-13-${idx}`} className="leading-snug">Date of Service *</FieldLabel>
                        <Input id={`${formId}-field-13-${idx}`}
                          type="date"
                          value={line.serviceDate}
                          onChange={(e) => handleLineChange(idx, "serviceDate", e.target.value)}
                          className="h-11 min-w-0 text-base sm:h-10 md:text-sm"
                          required
                        />
                      </Field>

                      {/* Description */}
                      <Field className="min-w-0 gap-2 @lg/billing-dialog:col-span-2">
                        <FieldLabel htmlFor={`${formId}-field-14-${idx}`} className="leading-snug">Service Description *</FieldLabel>
                        <Input id={`${formId}-field-14-${idx}`}
                          placeholder="e.g. One-Way Transport, Mileage"
                          value={line.description}
                          onChange={(e) => handleLineChange(idx, "description", e.target.value)}
                          className="h-11 min-w-0 text-base sm:h-10 md:text-sm"
                          required
                        />
                      </Field>
                    </FieldGroup>

                    <FieldGroup className="grid min-w-0 grid-cols-1 gap-4 @lg/billing-dialog:grid-cols-2">
                      {/* HCPCS */}
                      <Field className="min-w-0 gap-2">
                        <FieldLabel htmlFor={`${formId}-field-15-${idx}`} className="leading-snug">HCPCS Code</FieldLabel>
                        <Input id={`${formId}-field-15-${idx}`}
                          placeholder="A0130 / S0209"
                          value={line.hcpcsCode}
                          onChange={(e) => handleLineChange(idx, "hcpcsCode", e.target.value)}
                          className="h-11 min-w-0 text-base sm:h-10 md:text-sm font-mono"
                        />
                      </Field>

                      {/* Unit Type */}
                      <Field className="min-w-0 gap-2">
                        <FieldLabel htmlFor={`${formId}-field-16-${idx}`} className="leading-snug">Unit Type</FieldLabel>
                        <Select
                          value={line.unitType}
                          onValueChange={(value) => {
                            const result = billingLineSchema.shape.unit_type.safeParse(value);
                            if (result.success) handleLineChange(idx, "unitType", result.data);
                          }}
                        >
                          <SelectTrigger id={`${formId}-field-16-${idx}`} className="w-full min-w-0 text-base data-[size=default]:h-11 sm:data-[size=default]:h-10 md:text-sm [&_[data-slot=select-value]]:min-w-0 [&_[data-slot=select-value]]:truncate">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent position="popper" className="billing-surface w-[var(--radix-select-trigger-width)] max-w-[calc(100vw-2rem)] [&_[data-slot=select-item]]:whitespace-normal [&_[data-slot=select-item]]:break-words">
                            <SelectGroup>
                              <SelectItem value="one_way_trips">One-Way Trips</SelectItem>
                              <SelectItem value="miles">Miles</SelectItem>
                              <SelectItem value="hours">Hours</SelectItem>
                              <SelectItem value="units">Units</SelectItem>
                              <SelectItem value="flat_rate">Flat Rate</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      </Field>

                      {/* Quantity */}
                      <Field className="min-w-0 gap-2">
                        <FieldLabel htmlFor={`${formId}-field-17-${idx}`} className="leading-snug">Quantity</FieldLabel>
                        <Input id={`${formId}-field-17-${idx}`}
                          type="number"
                          step="0.01"
                          value={line.quantity}
                          onChange={(e) => handleLineChange(idx, "quantity", e.target.value)}
                          className="h-11 min-w-0 text-base sm:h-10 md:text-sm"
                          required
                        />
                      </Field>

                      {/* Unit Rate */}
                      <Field className="min-w-0 gap-2">
                        <FieldLabel htmlFor={`${formId}-field-18-${idx}`} className="leading-snug">Unit Rate ($)</FieldLabel>
                        <Input id={`${formId}-field-18-${idx}`}
                          type="number"
                          step="0.01"
                          value={line.unitRate}
                          onChange={(e) => handleLineChange(idx, "unitRate", e.target.value)}
                          className="h-11 min-w-0 text-base sm:h-10 md:text-sm"
                        />
                      </Field>

                      {/* Line Billed Amount */}
                      <Field className="min-w-0 gap-2">
                        <FieldLabel htmlFor={`${formId}-field-19-${idx}`} className="leading-snug">Billed ($) *</FieldLabel>
                        <Input id={`${formId}-field-19-${idx}`}
                          type="number"
                          step="0.01"
                          value={line.billedAmount}
                          onChange={(e) => handleLineChange(idx, "billedAmount", e.target.value)}
                          className="h-11 min-w-0 text-base sm:h-10 md:text-sm"
                          required
                        />
                      </Field>
                    </FieldGroup>

                    {/* Optional Trip Linking */}
                    {clientTrips.length > 0 && (
                      <Field className="min-w-0 gap-2">
                        <FieldLabel htmlFor={`${formId}-field-20-${idx}`} className="leading-snug">
                          Link Completed Trip:
                        </FieldLabel>
                        <Select
                          value={line.tripId || "none"}
                          onValueChange={(val) =>
                            handleLineChange(idx, "tripId", val === "none" ? "" : val)
                          }
                        >
                          <SelectTrigger id={`${formId}-field-20-${idx}`} className="w-full min-w-0 text-base data-[size=default]:h-11 sm:data-[size=default]:h-10 md:text-sm [&_[data-slot=select-value]]:min-w-0 [&_[data-slot=select-value]]:truncate">
                            <SelectValue placeholder="No trip linked (Manual/Historical)" />
                          </SelectTrigger>
                          <SelectContent position="popper" className="billing-surface w-[var(--radix-select-trigger-width)] max-w-[calc(100vw-2rem)] [&_[data-slot=select-item]]:whitespace-normal [&_[data-slot=select-item]]:break-words">
                            <SelectGroup>
                              <SelectItem value="none">No trip linked (Manual record)</SelectItem>
                              {clientTrips.map((t) => (
                                <SelectItem key={t.id} value={t.id}>
                                  {t.pickup_time ? t.pickup_time.slice(0, 16).replace("T", " ") : "Trip"}: {t.pickup_address?.slice(0, 20)}... → {t.dropoff_address?.slice(0, 20)}... ({t.distance_miles || 0} mi)
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          </SelectContent>
                        </Select>

                        {line.tripId && (
                          <Select
                            value={line.tripComponent || "transport"}
                            onValueChange={(value) => {
                              const result = billingLineSchema.shape.trip_component.safeParse(value);
                              if (result.success && result.data) {
                                handleLineChange(idx, "tripComponent", result.data);
                              }
                            }}
                          >
                            <SelectTrigger aria-label={`Service component for line ${idx + 1}`} className="w-full min-w-0 text-base data-[size=default]:h-11 sm:data-[size=default]:h-10 md:text-sm [&_[data-slot=select-value]]:min-w-0 [&_[data-slot=select-value]]:truncate">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent position="popper" className="billing-surface w-[var(--radix-select-trigger-width)] max-w-[calc(100vw-2rem)] [&_[data-slot=select-item]]:whitespace-normal [&_[data-slot=select-item]]:break-words">
                              <SelectGroup>
                                <SelectItem value="transport">Transport</SelectItem>
                                <SelectItem value="mileage">Mileage</SelectItem>
                                <SelectItem value="wait_time">Wait Time</SelectItem>
                                <SelectItem value="no_show">No Show</SelectItem>
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                        )}
                      </Field>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* 4. Total Billed Summary Banner */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-muted/40 border border-border rounded-xl">
              <span className="text-xs font-bold text-foreground">Calculated Total Billed:</span>
              <span className="text-xl font-black text-foreground tracking-tight">
                {formatMoney(totalBilled)}
              </span>
            </div>

            {/* 5. Notes & Follow-up */}
            <FieldGroup className="grid min-w-0 grid-cols-1 gap-4 @lg/billing-dialog:grid-cols-2">
              <Field className="min-w-0 gap-2">
                <FieldLabel htmlFor={`${formId}-field-21`} className="leading-snug">Next Follow-up Date</FieldLabel>
                <Input id={`${formId}-field-21`}
                  type="date"
                  value={nextFollowUpDate}
                  onChange={(e) => setNextFollowUpDate(e.target.value)}
                  className="h-11 min-w-0 text-base sm:h-10 md:text-sm"
                />
              </Field>
              <Field className="min-w-0 gap-2">
                <FieldLabel htmlFor={`${formId}-field-22`} className="leading-snug">Notes / Documentation</FieldLabel>
                <Input id={`${formId}-field-22`}
                  placeholder="Optional notes or external tracking references"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="h-11 min-w-0 text-base sm:h-10 md:text-sm"
                />
              </Field>
            </FieldGroup>

          </BillingDialogBody>
          <BillingDialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="h-auto min-h-11 whitespace-normal sm:min-h-9"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending}
              className="h-auto min-h-11 whitespace-normal sm:min-h-9"
            >
              {createMutation.isPending ? (
                <>
                  <ArrowsClockwise className="size-4 animate-spin motion-reduce:animate-none" />
                  Saving...
                </>
              ) : isSubmittedExternally ? (
                "Record External Submission"
              ) : (
                "Save Internal Draft"
              )}
            </Button>
          </BillingDialogFooter>
        </form>
      </BillingDialogContent>
    </Dialog>
  );
}
