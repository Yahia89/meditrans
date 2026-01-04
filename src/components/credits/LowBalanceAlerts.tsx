"use client";

import { CreditCard, Warning, ArrowRight } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Loader2 } from "lucide-react";

interface LowBalancePatient {
  id: string;
  full_name: string;
  monthly_credit: number;
  remainingBalance: number;
  percentRemaining: number;
}

const LOW_BALANCE_THRESHOLD = 0.2; // 20%
const ESTIMATED_COST_PER_TRIP = 50;

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
        const remainingBalance = monthlyCredit - totalSpend;
        const percentRemaining =
          monthlyCredit > 0 ? remainingBalance / monthlyCredit : 1;

        if (percentRemaining <= LOW_BALANCE_THRESHOLD && monthlyCredit > 0) {
          lowBalance.push({
            id: patient.id,
            full_name: patient.full_name,
            monthly_credit: monthlyCredit,
            remainingBalance,
            percentRemaining,
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

  return (
    <button
      onClick={onNavigate}
      className="w-full flex items-start gap-4 p-4 rounded-xl bg-red-50 border border-red-100 transition-all hover:bg-red-100 hover:border-red-200 cursor-pointer group text-left"
    >
      <div className="w-10 h-10 rounded-xl bg-red-100 text-red-700 flex items-center justify-center flex-shrink-0 group-hover:bg-red-600 group-hover:text-white transition-colors">
        <Warning size={20} weight="fill" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <h4 className="font-bold text-slate-900 text-sm">
            Low Credit Balance
          </h4>
          <span className="px-2 py-0.5 rounded-full bg-red-200 text-red-800 text-[10px] font-bold">
            {lowBalancePatients.length}
          </span>
        </div>
        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
          {lowBalancePatients.length === 1
            ? `${lowBalancePatients[0].full_name} has low credit balance`
            : `${lowBalancePatients.length} clients have low credit balances`}
        </p>
        <div className="flex items-center gap-1 mt-2 text-xs text-red-600 font-medium">
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
