import { BillingDialogContent, BillingDialogHeader, BillingDialogBody, BillingDialogFooter } from "./BillingDialogLayout";
import { useId, useState, type FormEvent } from "react";
import {
  Dialog,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
import { Scales, ArrowsClockwise } from "@phosphor-icons/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useOrganization } from "@/contexts/OrganizationContext";
import { recordAdjustment } from "../api/adjustments";
import type { AdjustmentType } from "../types/billing";
import { recordAdjustmentSchema } from "../types/schemas";
import { billingQueryKeys } from "../hooks/queryKeys";
import { toast } from "sonner";

interface RecordAdjustmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recordId: string;
  internalReference: string;
}

export function RecordAdjustmentDialog({
  open,
  onOpenChange,
  recordId,
  internalReference,
}: RecordAdjustmentDialogProps) {
  const formId = useId();
  const queryClient = useQueryClient();
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;

  const [adjustmentType, setAdjustmentType] = useState<AdjustmentType>("contractual_allowance");
  const [amount, setAmount] = useState<string>("");
  const [reason, setReason] = useState<string>("");

  const adjustmentMutation = useMutation({
    mutationFn: () => {
      return recordAdjustment(recordId, {
        adjustment_type: adjustmentType,
        amount,
        reason: reason.trim(),
      });
    },
    onSuccess: () => {
      toast.success("Adjustment recorded successfully");
      if (orgId) {
        queryClient.invalidateQueries({ queryKey: billingQueryKeys.all(orgId) });
      }
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to record adjustment");
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!amount || Number(amount) === 0) {
      toast.error("Please enter a non-zero adjustment amount");
      return;
    }
    if (!reason.trim()) {
      toast.error("Adjustment reason is required");
      return;
    }
    adjustmentMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <BillingDialogContent className="max-w-md">
        <BillingDialogHeader>
          <DialogTitle className="flex items-start gap-2 text-lg leading-snug [&_svg]:shrink-0">
            <Scales size={20} weight="bold" className="text-primary" />
            Record Adjustment
          </DialogTitle>
          <DialogDescription className="leading-relaxed">
            For record: <span className="font-bold text-foreground">{internalReference}</span>
          </DialogDescription>
        </BillingDialogHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <BillingDialogBody>
            <Field className="min-w-0 gap-2">
              <FieldLabel htmlFor={`${formId}-field-1`} className="leading-snug">Adjustment Type *</FieldLabel>
              <Select
                value={adjustmentType}
                onValueChange={(value) => {
                  const result = recordAdjustmentSchema.shape.adjustment_type.safeParse(value);
                  if (result.success) setAdjustmentType(result.data);
                }}
              >
                <SelectTrigger id={`${formId}-field-1`} className="w-full min-w-0 text-base data-[size=default]:h-11 sm:data-[size=default]:h-10 md:text-sm [&_[data-slot=select-value]]:min-w-0 [&_[data-slot=select-value]]:truncate">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper" className="billing-surface w-[var(--radix-select-trigger-width)] max-w-[calc(100vw-2rem)] [&_[data-slot=select-item]]:whitespace-normal [&_[data-slot=select-item]]:break-words">
                  <SelectGroup>
                    <SelectItem value="contractual_allowance">Contractual Allowance / Fee Schedule</SelectItem>
                    <SelectItem value="payer_reduction">Payer Rate Reduction</SelectItem>
                    <SelectItem value="discretionary_write_off">Discretionary Authorized Write-off</SelectItem>
                    <SelectItem value="copay_deductible">Copay / Deductible</SelectItem>
                    <SelectItem value="reversal">Adjustment Reversal</SelectItem>
                    <SelectItem value="recoupment">Payer Recoupment</SelectItem>
                    <SelectItem value="other">Other Adjustment</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>

            <Field className="min-w-0 gap-2">
              <FieldLabel htmlFor={`${formId}-field-2`} className="leading-snug">Adjustment Amount ($) *</FieldLabel>
              <Input id={`${formId}-field-2`}
                type="number"
                step="0.01"
                placeholder="e.g. 15.00 (reduces balance) or -15.00 (recoupment)"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="h-11 min-w-0 text-base sm:h-10 md:text-sm"
                required
              />
              <p className="text-xs text-muted-foreground">
                Positive amount reduces open balance. Negative amount increases open balance.
              </p>
            </Field>

            <Field className="min-w-0 gap-2">
              <FieldLabel htmlFor={`${formId}-field-3`} className="leading-snug">Required Reason & Authority *</FieldLabel>
              <Textarea id={`${formId}-field-3`}
                placeholder="State explicit reason and payer/statutory reference for this adjustment"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="min-h-24 min-w-0 resize-y text-base md:text-sm"
                rows={3}
                required
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
              disabled={adjustmentMutation.isPending}
              className="h-auto min-h-11 whitespace-normal sm:min-h-9"
            >
              {adjustmentMutation.isPending ? (
                <>
                  <ArrowsClockwise className="size-3.5 animate-spin motion-reduce:animate-none" />
                  Saving...
                </>
              ) : (
                "Post Adjustment"
              )}
            </Button>
          </BillingDialogFooter>
        </form>
      </BillingDialogContent>
    </Dialog>
  );
}
