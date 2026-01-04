"use client";

import { useState, useMemo } from "react";
import {
  X,
  Plus,
  User,
  MagnifyingGlass,
  CreditCard,
} from "@phosphor-icons/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Loader2 } from "lucide-react";

interface Patient {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  referral_date: string | null;
  monthly_credit: number | null;
}

interface AddPatientToCreditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function AddPatientToCreditDialog({
  open,
  onOpenChange,
  onSuccess,
}: AddPatientToCreditDialogProps) {
  const { currentOrganization } = useOrganization();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [monthlyCredit, setMonthlyCredit] = useState("");
  const [creditUsedFor, setCreditUsedFor] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch all patients (both with and without credits)
  const { data: allPatients = [], isLoading } = useQuery({
    queryKey: ["all-patients-for-credits", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      const { data, error } = await supabase
        .from("patients")
        .select("id, full_name, phone, email, referral_date, monthly_credit")
        .eq("org_id", currentOrganization.id)
        .order("full_name", { ascending: true });

      if (error) throw error;
      return data as Patient[];
    },
    enabled: !!currentOrganization?.id && open,
  });

  // Filter patients without credits
  const patientsWithoutCredits = useMemo(() => {
    return allPatients.filter((p) => !p.monthly_credit);
  }, [allPatients]);

  // Search filter
  const filteredPatients = useMemo(() => {
    if (!searchQuery) return patientsWithoutCredits;
    const query = searchQuery.toLowerCase();
    return patientsWithoutCredits.filter(
      (p) =>
        p.full_name.toLowerCase().includes(query) ||
        p.email?.toLowerCase().includes(query) ||
        p.phone?.includes(query)
    );
  }, [patientsWithoutCredits, searchQuery]);

  const handleSubmit = async () => {
    if (!selectedPatient) {
      setError("Please select a patient");
      return;
    }

    const creditValue = parseFloat(monthlyCredit);
    if (isNaN(creditValue) || creditValue <= 0) {
      setError("Please enter a valid credit amount");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const { error: updateError } = await supabase
        .from("patients")
        .update({
          monthly_credit: creditValue,
          credit_used_for: creditUsedFor || null,
          notes: notes || null,
          referral_date:
            selectedPatient.referral_date ||
            new Date().toISOString().split("T")[0],
        })
        .eq("id", selectedPatient.id);

      if (updateError) throw updateError;

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ["patients-credits"] });
      queryClient.invalidateQueries({ queryKey: ["all-patients-for-credits"] });
      queryClient.invalidateQueries({ queryKey: ["low-balance-patients"] });

      onSuccess?.();
      handleClose();
    } catch (err) {
      console.error("Failed to add patient to credits:", err);
      setError(err instanceof Error ? err.message : "Failed to add patient");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setSelectedPatient(null);
    setMonthlyCredit("");
    setCreditUsedFor("");
    setNotes("");
    setSearchQuery("");
    setError(null);
    onOpenChange(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Dialog */}
      <div className="relative z-10 w-full max-w-lg mx-4 bg-white rounded-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <Plus weight="duotone" className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Add Patient to Credits
              </h2>
              <p className="text-sm text-slate-500">
                {patientsWithoutCredits.length} patients available
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X weight="bold" className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-700">
              {error}
            </div>
          )}

          {!selectedPatient ? (
            <>
              {/* Search */}
              <div className="relative">
                <MagnifyingGlass
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  placeholder="Search patients..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-11 pl-10 pr-4 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  autoFocus
                />
              </div>

              {/* Patient List */}
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {isLoading ? (
                  <div className="flex h-32 items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                  </div>
                ) : filteredPatients.length === 0 ? (
                  <div className="text-center py-8 text-slate-500 text-sm">
                    {searchQuery
                      ? "No patients match your search"
                      : "All patients already have credits assigned"}
                  </div>
                ) : (
                  filteredPatients.map((patient) => (
                    <button
                      key={patient.id}
                      onClick={() => setSelectedPatient(patient)}
                      className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50 hover:bg-emerald-50 hover:border-emerald-200 transition-colors text-left"
                    >
                      <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
                        <User
                          weight="duotone"
                          className="w-5 h-5 text-slate-500"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-slate-900 truncate">
                          {patient.full_name}
                        </p>
                        <p className="text-xs text-slate-500 truncate">
                          {patient.email || patient.phone || "No contact info"}
                        </p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </>
          ) : (
            <>
              {/* Selected Patient */}
              <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                  <User weight="duotone" className="w-6 h-6 text-emerald-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-900">
                    {selectedPatient.full_name}
                  </p>
                  <p className="text-sm text-slate-500">
                    {selectedPatient.email ||
                      selectedPatient.phone ||
                      "No contact info"}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedPatient(null)}
                  className="p-1.5 rounded-lg hover:bg-emerald-100 transition-colors"
                >
                  <X weight="bold" className="w-4 h-4 text-emerald-600" />
                </button>
              </div>

              {/* Credit Amount */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-700">
                  Monthly Credit Limit *
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
                    placeholder="1000.00"
                    className="w-full h-11 pl-8 pr-4 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                    autoFocus
                  />
                </div>
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
                  <option value="Doctor Appointments">
                    Doctor Appointments
                  </option>
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
                  placeholder="Add any notes..."
                  rows={2}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 resize-none"
                />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {selectedPatient && (
          <div className="flex items-center justify-end gap-3 p-5 border-t border-slate-100 flex-shrink-0">
            <Button
              variant="outline"
              onClick={() => setSelectedPatient(null)}
              className="rounded-xl"
            >
              Back
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !monthlyCredit}
              className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <CreditCard weight="duotone" className="w-4 h-4" />
                  Add to Credits
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
