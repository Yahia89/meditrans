import { BillingDialogContent, BillingDialogHeader, BillingDialogBody, BillingDialogFooter } from "./BillingDialogLayout";
import { useId, useState, useMemo, type FormEvent } from "react";
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
import {
  Coins,
  ArrowsClockwise,
  Plus,
  Trash,
  WarningCircle,
} from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useBillingPayers } from "../hooks/useBillingPayers";
import { useRecordPayment } from "../hooks/useBillingPayments";
import type { PaymentMethod } from "../types/billing";
import { recordPaymentSchema } from "../types/schemas";
import { getBillingAllocationRecords } from "../api/records";
import {
  addMoney,
  subtractMoney,
  formatMoney,
  compareMoney,
} from "../utils/decimal";
import { toast } from "sonner";

interface RecordPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedRecordId?: string;
}

interface AllocationDraft {
  recordId: string;
  amount: string;
  notes?: string;
}

export function RecordPaymentDialog({
  open,
  onOpenChange,
  preselectedRecordId,
}: RecordPaymentDialogProps) {
  const formId = useId();
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;

  const { data: payers = [] } = useBillingPayers();
  const paymentMutation = useRecordPayment();

  const [payerId, setPayerId] = useState<string>("");
  const [totalAmount, setTotalAmount] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("eft");
  const [referenceNumber, setReferenceNumber] = useState<string>("");
  const [payerReportedDate, setPayerReportedDate] = useState<string>("");
  const [receivedDate, setReceivedDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [notes, setNotes] = useState<string>("");

  const [allocations, setAllocations] = useState<AllocationDraft[]>([]);

  // Fetch open records for allocation
  const { data: openRecords = [] } = useQuery({
    queryKey: ["open-records-for-payment", orgId, payerId],
    queryFn: async () => {
      if (!orgId) return [];
      return getBillingAllocationRecords(orgId, payerId || undefined);
    },
    enabled: !!orgId && open,
  });

  // Preselection initialization during render (React-recommended pattern instead of effect)
  const [initializedPreselection, setInitializedPreselection] = useState<string | null>(null);
  if (
    open &&
    preselectedRecordId &&
    initializedPreselection !== preselectedRecordId &&
    openRecords.length > 0
  ) {
    const match = openRecords.find((r) => r.id === preselectedRecordId);
    if (match) {
      setInitializedPreselection(preselectedRecordId);
      if (!payerId && match.payer_id) {
        setPayerId(match.payer_id);
      }
      if (allocations.length === 0) {
        setAllocations([
          {
            recordId: match.id,
            amount: match.outstanding_balance || "0.00",
          },
        ]);
      }
      if (!totalAmount) {
        setTotalAmount(match.outstanding_balance || "0.00");
      }
    }
  }

  // Calculate allocated sum and unapplied cash
  const totalAllocated = useMemo(() => {
    let sum = "0.00";
    for (const a of allocations) {
      if (a.amount && Number(a.amount) > 0) {
        sum = addMoney(sum, a.amount);
      }
    }
    return sum;
  }, [allocations]);

  const unappliedCash = useMemo(() => {
    if (!totalAmount || Number(totalAmount) <= 0) return "0.00";
    return subtractMoney(totalAmount, totalAllocated);
  }, [totalAmount, totalAllocated]);

  const isOverAllocated = compareMoney(totalAllocated, totalAmount || "0") > 0;

  const handleAddAllocation = () => {
    // Pick the first available open record not yet allocated
    const usedIds = new Set(allocations.map((a) => a.recordId));
    const available = openRecords.find((r) => !usedIds.has(r.id));
    if (!available) {
      toast.error("No additional open records available to allocate");
      return;
    }

    // Default amount to remaining balance of that record or remaining unapplied cash
    const targetAmt =
      compareMoney(unappliedCash, available.outstanding_balance) < 0 &&
        compareMoney(unappliedCash, "0.00") > 0
        ? unappliedCash
        : available.outstanding_balance;

    setAllocations((prev) => [
      ...prev,
      {
        recordId: available.id,
        amount: Number(targetAmt) > 0 ? targetAmt : "0.00",
      },
    ]);
  };

  const handleRemoveAllocation = (index: number) => {
    setAllocations((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAllocationChange = (
    index: number,
    field: keyof AllocationDraft,
    value: string
  ) => {
    setAllocations((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!payerId) {
      toast.error("Please select a payer");
      return;
    }
    if (!totalAmount || Number(totalAmount) <= 0) {
      toast.error("Please enter a valid payment amount greater than zero");
      return;
    }
    if (!referenceNumber.trim()) {
      toast.error("Please enter a payment or EFT reference number");
      return;
    }
    if (isOverAllocated) {
      toast.error("Allocations cannot exceed total payment amount");
      return;
    }

    try {
      await paymentMutation.mutateAsync({
        payer_id: payerId,
        amount: totalAmount,
        payment_method: paymentMethod,
        reference_number: referenceNumber.trim(),
        payer_reported_date: payerReportedDate || undefined,
        received_date: receivedDate || undefined,
        notes: notes.trim() || undefined,
        allocations: allocations
          .filter((allocation) => Number(allocation.amount) > 0)
          .map((allocation) => ({
            record_id: allocation.recordId,
            amount: allocation.amount,
            notes: allocation.notes,
          })),
      });
      onOpenChange(false);
    } catch (err: unknown) {
      console.error("Failed to record payment:", err instanceof Error ? err.message : err);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <BillingDialogContent className="max-w-2xl">
        <BillingDialogHeader>
          <DialogTitle className="flex items-start gap-2 text-lg leading-snug [&_svg]:shrink-0">
            <Coins size={20} weight="bold" className="text-primary" />
            Record Payment & Allocations
          </DialogTitle>
          <DialogDescription className="leading-relaxed">
            Record EFT remittances, checks, or partner payments and allocate to open claims/invoices.
          </DialogDescription>
        </BillingDialogHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <BillingDialogBody>
            {/* Header Row */}
            <FieldGroup className="grid min-w-0 grid-cols-1 gap-4 @lg/billing-dialog:grid-cols-2">
              <Field className="min-w-0 gap-2">
                <FieldLabel htmlFor={`${formId}-field-1`} className="leading-snug">Payer *</FieldLabel>
                <Select value={payerId} onValueChange={setPayerId}>
                  <SelectTrigger id={`${formId}-field-1`} className="w-full min-w-0 text-base data-[size=default]:h-11 sm:data-[size=default]:h-10 md:text-sm [&_[data-slot=select-value]]:min-w-0 [&_[data-slot=select-value]]:truncate">
                    <SelectValue placeholder="Select Payer" />
                  </SelectTrigger>
                  <SelectContent position="popper" className="billing-surface w-[var(--radix-select-trigger-width)] max-w-[calc(100vw-2rem)] [&_[data-slot=select-item]]:whitespace-normal [&_[data-slot=select-item]]:break-words">
                    <SelectGroup>
                      {payers.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>

              <Field className="min-w-0 gap-2">
                <FieldLabel htmlFor={`${formId}-field-2`} className="leading-snug">Total Payment Amount ($) *</FieldLabel>
                <Input id={`${formId}-field-2`}
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={totalAmount}
                  onChange={(e) => setTotalAmount(e.target.value)}
                  className="h-11 min-w-0 text-base sm:h-10 md:text-sm"
                  required
                />
              </Field>
            </FieldGroup>

            <FieldGroup className="grid min-w-0 grid-cols-1 gap-4 @lg/billing-dialog:grid-cols-2">
              <Field className="min-w-0 gap-2">
                <FieldLabel htmlFor={`${formId}-field-3`} className="leading-snug">Payment Method *</FieldLabel>
                <Select
                  value={paymentMethod}
                  onValueChange={(value) => {
                    const result = recordPaymentSchema.shape.payment_method.safeParse(value);
                    if (result.success) setPaymentMethod(result.data);
                  }}
                >
                  <SelectTrigger id={`${formId}-field-3`} className="w-full min-w-0 text-base data-[size=default]:h-11 sm:data-[size=default]:h-10 md:text-sm [&_[data-slot=select-value]]:min-w-0 [&_[data-slot=select-value]]:truncate">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper" className="billing-surface w-[var(--radix-select-trigger-width)] max-w-[calc(100vw-2rem)] [&_[data-slot=select-item]]:whitespace-normal [&_[data-slot=select-item]]:break-words">
                    <SelectGroup>
                      <SelectItem value="eft">EFT / Direct Deposit</SelectItem>
                      <SelectItem value="check">Paper Check</SelectItem>
                      <SelectItem value="ach">ACH Transfer</SelectItem>
                      <SelectItem value="credit_card">Credit Card</SelectItem>
                      <SelectItem value="virtual_card">Virtual Card</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>

              <Field className="min-w-0 gap-2">
                <FieldLabel htmlFor={`${formId}-field-4`} className="leading-snug">Reference / Trace # *</FieldLabel>
                <Input id={`${formId}-field-4`}
                  placeholder="EFT Trace # or Check #"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  className="h-11 min-w-0 text-base sm:h-10 md:text-sm font-mono"
                  required
                />
              </Field>

              <Field className="min-w-0 gap-2">
                <FieldLabel htmlFor={`${formId}-field-5`} className="leading-snug">Confirmed Received Date</FieldLabel>
                <Input id={`${formId}-field-5`}
                  type="date"
                  value={receivedDate}
                  onChange={(e) => setReceivedDate(e.target.value)}
                  className="h-11 min-w-0 text-base sm:h-10 md:text-sm"
                />
              </Field>

              <Field className="min-w-0 gap-2">
                <FieldLabel htmlFor={`${formId}-field-6`} className="leading-snug">Payer Remittance Date</FieldLabel>
                <Input id={`${formId}-field-6`}
                  type="date"
                  value={payerReportedDate}
                  onChange={(e) => setPayerReportedDate(e.target.value)}
                  className="h-11 min-w-0 text-base sm:h-10 md:text-sm"
                />
              </Field>
            </FieldGroup>

            {/* Allocation Section */}
            <div className="p-4 bg-muted/40 border border-border rounded-xl flex flex-col gap-3">
              <div className="flex flex-col items-start gap-3 @lg/billing-dialog:flex-row @lg/billing-dialog:items-center @lg/billing-dialog:justify-between">
                <div>
                  <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
                    Payment Allocations
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Allocate funds across one or more billing records covered by this remittance.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddAllocation}
                  disabled={!payerId || openRecords.length === 0}
                  className="h-auto min-h-11 whitespace-normal sm:min-h-9"
                >
                  <Plus size={14} weight="bold" />
                  Allocate to Record
                </Button>
              </div>

              {allocations.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground bg-background border border-dashed border-border rounded-lg">
                  No records allocated yet. The entire payment of{" "}
                  <span className="font-bold text-foreground">{formatMoney(totalAmount || "0")}</span>{" "}
                  will remain as unapplied cash.
                </div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {allocations.map((alloc, idx) => {
                    return (
                      <FieldGroup
                        key={idx}
                        className="grid min-w-0 grid-cols-1 items-end gap-3 rounded-lg border bg-background p-3 @lg/billing-dialog:grid-cols-[minmax(0,1fr)_8rem_auto]"
                      >
                        <Field className="min-w-0 gap-2">
                          <FieldLabel htmlFor={`${formId}-field-7-${idx}`} className="leading-snug">
                            Target Record
                          </FieldLabel>
                          <Select
                            value={alloc.recordId}
                            onValueChange={(val) =>
                              handleAllocationChange(idx, "recordId", val)
                            }
                          >
                            <SelectTrigger id={`${formId}-field-7-${idx}`} className="w-full min-w-0 text-base data-[size=default]:h-11 sm:data-[size=default]:h-10 md:text-sm [&_[data-slot=select-value]]:min-w-0 [&_[data-slot=select-value]]:truncate">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent position="popper" className="billing-surface w-[var(--radix-select-trigger-width)] max-w-[calc(100vw-2rem)] [&_[data-slot=select-item]]:whitespace-normal [&_[data-slot=select-item]]:break-words">
                              <SelectGroup>
                                {openRecords.map((r) => (
                                  <SelectItem key={r.id} value={r.id}>
                                    {r.internal_reference} ({r.client?.full_name || "Invoice"}) — Open: {formatMoney(r.outstanding_balance)}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                        </Field>

                        <Field className="min-w-0 gap-2">
                          <FieldLabel htmlFor={`${formId}-field-8-${idx}`} className="leading-snug">
                            Amount ($)
                          </FieldLabel>
                          <Input id={`${formId}-field-8-${idx}`}
                            type="number"
                            step="0.01"
                            value={alloc.amount}
                            onChange={(e) =>
                              handleAllocationChange(idx, "amount", e.target.value)
                            }
                            className="h-11 min-w-0 text-base sm:h-10 md:text-sm"
                          />
                        </Field>

                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveAllocation(idx)}
                          aria-label={`Remove allocation ${idx + 1}`}
                          className="size-11 shrink-0 p-0 sm:size-9"
                        >
                          <Trash size={14} />
                        </Button>
                      </FieldGroup>
                    );
                  })}
                </div>
              )}

              {/* Allocation Totals Bar */}
              <div className="pt-2 border-t border-border flex flex-wrap items-center justify-between text-xs gap-2">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <span>
                    Allocated: <strong className="text-foreground">{formatMoney(totalAllocated)}</strong>
                  </span>
                  <span>
                    Unapplied:{" "}
                    <strong
                      className={
                        compareMoney(unappliedCash, "0.00") < 0
                          ? "font-bold text-destructive"
                          : "text-foreground"
                      }
                    >
                      {formatMoney(unappliedCash)}
                    </strong>
                  </span>
                </div>
                {isOverAllocated && (
                  <div className="text-destructive font-semibold text-xs flex items-center gap-1">
                    <WarningCircle size={14} weight="bold" />
                    Allocations exceed total payment amount!
                  </div>
                )}
              </div>
            </div>

            <Field className="min-w-0 gap-2">
              <FieldLabel htmlFor={`${formId}-field-9`} className="leading-snug">Notes / Remittance Advice</FieldLabel>
              <Textarea id={`${formId}-field-9`}
                placeholder="e.g. Received via EFT trace 10098234, Check copy attached."
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
              disabled={paymentMutation.isPending || isOverAllocated}
              className="h-auto min-h-11 whitespace-normal sm:min-h-9"
            >
              {paymentMutation.isPending ? (
                <>
                  <ArrowsClockwise className="size-3.5 animate-spin motion-reduce:animate-none" />
                  Recording...
                </>
              ) : (
                "Save Payment"
              )}
            </Button>
          </BillingDialogFooter>
        </form>
      </BillingDialogContent>
    </Dialog>
  );
}
