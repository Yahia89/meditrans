"use client";

import { useState } from "react";
import { X, CreditCard, Plus, Pencil } from "@phosphor-icons/react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface CreditEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  patientName: string;
  currentMonthlyCredit?: number;
  currentNotes?: string;
  mode: "add" | "edit";
  onSuccess?: () => void;
}

export function CreditEntryDialog({
  open,
  onOpenChange,
  patientId,
  patientName,
  currentMonthlyCredit = 0,
  currentNotes = "",
  mode,
  onSuccess,
}: CreditEntryDialogProps) {
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [monthlyCredit, setMonthlyCredit] = useState(
    currentMonthlyCredit.toString()
  );
  const [creditUsedFor, setCreditUsedFor] = useState("");
  const [notes, setNotes] = useState(currentNotes);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const creditValue = parseFloat(monthlyCredit);
      if (isNaN(creditValue) || creditValue < 0) {
        throw new Error("Please enter a valid credit amount");
      }

      const { error: updateError } = await supabase
        .from("patients")
        .update({
          monthly_credit: creditValue,
          credit_used_for: creditUsedFor || null,
          notes: notes || null,
        })
        .eq("id", patientId);

      if (updateError) throw updateError;

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ["patients-credits"] });
      queryClient.invalidateQueries({ queryKey: ["patient", patientId] });
      queryClient.invalidateQueries({ queryKey: ["low-balance-patients"] });

      onSuccess?.();
      onOpenChange(false);
    } catch (err) {
      console.error("Failed to update credit:", err);
      setError(err instanceof Error ? err.message : "Failed to update credit");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setMonthlyCredit(currentMonthlyCredit.toString());
    setNotes(currentNotes);
    setCreditUsedFor("");
    setError(null);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />

      {/* Dialog */}
      <div className="relative z-10 w-full max-w-md mx-4 bg-white rounded-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              {mode === "add" ? (
                <Plus weight="duotone" className="w-5 h-5" />
              ) : (
                <Pencil weight="duotone" className="w-5 h-5" />
              )}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                {mode === "add" ? "Add Credit" : "Edit Credit"}
              </h2>
              <p className="text-sm text-slate-500">{patientName}</p>
            </div>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X weight="bold" className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Monthly Credit */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">
              Monthly Credit Limit
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium">
                $
              </span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={monthlyCredit}
                onChange={(e) => setMonthlyCredit(e.target.value)}
                placeholder="0.00"
                className="w-full h-11 pl-8 pr-4 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                required
              />
            </div>
            <p className="text-xs text-slate-500">
              The maximum credit amount for this patient per month
            </p>
          </div>

          {/* Credit Used For */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">
              Credit Used For
            </label>
            <select
              value={creditUsedFor}
              onChange={(e) => setCreditUsedFor(e.target.value)}
              className="w-full h-11 px-4 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            >
              <option value="">Select usage type...</option>
              <option value="Medical Transportation">
                Medical Transportation
              </option>
              <option value="Dialysis Trips">Dialysis Trips</option>
              <option value="Doctor Appointments">Doctor Appointments</option>
              <option value="Therapy Sessions">Therapy Sessions</option>
              <option value="General Transportation">
                General Transportation
              </option>
              <option value="Other">Other</option>
            </select>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes about this patient's credit (e.g., service pending, special conditions)..."
              rows={3}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleReset}
              className="rounded-xl"
            >
              Reset
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <CreditCard weight="duotone" className="w-4 h-4" />
                  {mode === "add" ? "Add Credit" : "Save Changes"}
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
