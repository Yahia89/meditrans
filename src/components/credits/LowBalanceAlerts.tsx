"use client";

import { CreditCard, TriangleAlert, ArrowRight, LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/hooks/usePermissions";
import { useCreditAlerts } from "./useCreditAlerts";

export function LowBalanceAlerts({ onNavigate }: { onNavigate?: () => void }) {
  const { data: lowBalancePatients, isLoading, isError } = useCreditAlerts();

  const { canViewBilling } = usePermissions();

  if (isLoading) {
    return (
      <div className="flex items-start gap-4 p-4 rounded-xl bg-slate-50 border border-slate-100">
        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
          <LoaderCircle className="w-5 h-5 animate-spin text-slate-400" />
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

  if (isError) {
    return <p role="alert" className="p-4 text-sm text-slate-500">Unable to check credit balances. Please try again.</p>;
  }

  if (lowBalancePatients.length === 0) {
    return (
      <div className="flex items-start gap-4 p-4 rounded-xl bg-emerald-50 border border-emerald-100 transition-all">
        <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">
          <CreditCard size={20} />
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
    (p) => p.percentRemaining * 100 <= 5,
  ).length;
  const bgColor = criticalCount > 0 ? "bg-red-50 border-red-100" : "bg-amber-50 border-amber-100";
  const hoverBgColor = criticalCount > 0 ? "hover:bg-red-100 hover:border-red-200" : "hover:bg-amber-100 hover:border-amber-200";
  const iconBgColor = criticalCount > 0 ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700";
  const iconHoverBgColor = criticalCount > 0 ? "group-hover:bg-red-600" : "group-hover:bg-amber-600";
  const textColor = criticalCount > 0 ? "text-red-600" : "text-amber-600";

  return (
    <button
      onClick={canViewBilling ? onNavigate : undefined}
      disabled={!canViewBilling}
      className={cn(
        "w-full flex items-start gap-4 p-4 rounded-xl border transition-all group text-left",
        bgColor,
        canViewBilling ? cn("cursor-pointer", hoverBgColor) : "cursor-default select-none shadow-none",
      )}
    >
      <div
        className={cn(
          "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors",
          iconBgColor,
          canViewBilling && cn("group-hover:text-white", iconHoverBgColor),
        )}
      >
        {criticalCount > 0 ? (
          <TriangleAlert size={20} />
        ) : (
          <CreditCard size={20} />
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
                : "bg-amber-200 text-amber-800",
            )}
          >
            {lowBalancePatients.length}
          </span>
        </div>
        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
          {lowBalancePatients.length === 1
            ? `${lowBalancePatients[0].patientName} has ${(
                lowBalancePatients[0].percentRemaining * 100
              ).toFixed(0)}% credit remaining`
            : `${lowBalancePatients.length} clients are below 50% credit`}
        </p>
        {canViewBilling && (
          <div
            className={cn(
              "flex items-center gap-1 mt-2 text-xs font-medium",
              textColor,
            )}
          >
            <span>View details</span>
            <ArrowRight
              size={12}

              className="group-hover:translate-x-1 transition-transform"
            />
          </div>
        )}
      </div>
    </button>
  );
}
