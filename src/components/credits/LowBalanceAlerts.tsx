"use client";

import { CreditCard, Warning, ArrowRight } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Loader2 } from "lucide-react";
import {
  calculateCreditStatus,
  ESTIMATED_COST_PER_TRIP,
} from "@/lib/credit-utils";

interface LowBalancePatient {
  id: string;
  full_name: string;
  monthly_credit: number;
  remainingBalance: number;
  percentRemaining: number;
}

// Thresholds and cost moved to credit-utils.ts

export function LowBalanceAlerts({ onNavigate }: { onNavigate?: () => void }) {
  const { currentOrganization } = useOrganization();

  // Get current month range
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    0,
    23,
    59,
    59
  );

  // Fetch patients with credits
  const { data: lowBalancePatients = [], isLoading } = useQuery({
    queryKey: ["low-balance-patients", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];

      // Fetch patients with credits
      const { data: patients, error: patientsError } = await supabase
        .from("patients")
        .select("id, full_name, monthly_credit, notes")
        .eq("org_id", currentOrganization.id)
        .not("monthly_credit", "is", null);

      if (patientsError) throw patientsError;
      if (!patients?.length) return [];

      // Fetch completed trips for this month
      const { data: trips, error: tripsError } = await supabase
        .from("trips")
        .select("id, patient_id, status")
        .eq("org_id", currentOrganization.id)
        .eq("status", "completed")
        .gte("pickup_time", startOfMonth.toISOString())
        .lte("pickup_time", endOfMonth.toISOString());

      if (tripsError) throw tripsError;

      // Calculate low balance patients
      const lowBalance: LowBalancePatient[] = [];

      patients.forEach((patient) => {
        const patientTrips =
          trips?.filter((t) => t.patient_id === patient.id) || [];
        const totalSpend = patientTrips.length * ESTIMATED_COST_PER_TRIP;
        const monthlyCredit = patient.monthly_credit || 0;

        const creditInfo = calculateCreditStatus(monthlyCredit, totalSpend);

        if (creditInfo.status !== "good" && creditInfo.status !== "none") {
          lowBalance.push({
            id: patient.id,
            full_name: patient.full_name,
            monthly_credit: monthlyCredit,
            remainingBalance: monthlyCredit - totalSpend,
            percentRemaining: creditInfo.percentage / 100,
          });
        }
      });

      // Sort by percentage remaining (lowest first)
      return lowBalance.sort((a, b) => a.percentRemaining - b.percentRemaining);
    },
    enabled: !!currentOrganization?.id,
    refetchInterval: 60000, // Refresh every minute
  });

  if (isLoading) {
    return (
      <div className="flex items-start gap-4 p-4 rounded-xl bg-slate-50 border border-slate-100">
        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
        </div>
        <div className="flex-1">
          <h4 className="font-bold text-slate-900 text-sm">Loading...</h4>
          <p className="text-xs text-slate-500 mt-1">
            Checking credit balances
          </p>
        </div>
      </div>
    );
  }

  if (lowBalancePatients.length === 0) {
    return (
      <div className="flex items-start gap-4 p-4 rounded-xl bg-emerald-50 border border-emerald-100 transition-all">
        <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">
          <CreditCard size={20} weight="duotone" />
        </div>
        <div className="flex-1">
          <h4 className="font-bold text-slate-900 text-sm">
            Credit Health Good
          </h4>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            All clients have healthy credit balances.
          </p>
        </div>
      </div>
    );
  }

  const criticalCount = lowBalancePatients.filter(
    (p) => p.percentRemaining * 100 <= 5
  ).length;
  const bgColor =
    criticalCount > 0
      ? "bg-red-50 border-red-100 hover:bg-red-100 hover:border-red-200"
      : "bg-amber-50 border-amber-100 hover:bg-amber-100 hover:border-amber-200";
  const iconBgColor =
    criticalCount > 0
      ? "bg-red-100 text-red-700 group-hover:bg-red-600"
      : "bg-amber-100 text-amber-700 group-hover:bg-amber-600";
  const textColor = criticalCount > 0 ? "text-red-600" : "text-amber-600";

  return (
    <button
      onClick={onNavigate}
      className={cn(
        "w-full flex items-start gap-4 p-4 rounded-xl border transition-all cursor-pointer group text-left",
        bgColor
      )}
    >
      <div
        className={cn(
          "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:text-white transition-colors",
          iconBgColor
        )}
      >
        {criticalCount > 0 ? (
          <Warning size={20} weight="fill" />
        ) : (
          <CreditCard size={20} weight="duotone" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <h4 className="font-bold text-slate-900 text-sm">
            {criticalCount > 0
              ? "Critical Credit Alerts"
              : "Credit Balance Alerts"}
          </h4>
          <span
            className={cn(
              "px-2 py-0.5 rounded-full text-[10px] font-bold",
              criticalCount > 0
                ? "bg-red-200 text-red-800"
                : "bg-amber-200 text-amber-800"
            )}
          >
            {lowBalancePatients.length}
          </span>
        </div>
        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
          {lowBalancePatients.length === 1
            ? `${lowBalancePatients[0].full_name} has ${(
                lowBalancePatients[0].percentRemaining * 100
              ).toFixed(0)}% credit remaining`
            : `${lowBalancePatients.length} clients are below 50% credit`}
        </p>
        <div
          className={cn(
            "flex items-center gap-1 mt-2 text-xs font-medium",
            textColor
          )}
        >
          <span>View details</span>
          <ArrowRight
            size={12}
            weight="bold"
            className="group-hover:translate-x-1 transition-transform"
          />
        </div>
      </div>
    </button>
  );
}
