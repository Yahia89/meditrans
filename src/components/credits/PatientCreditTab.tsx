"use client";

import { useState, useMemo } from "react";
import {
  CreditCard,
  CaretLeft,
  CaretRight,
  CalendarBlank,
  Pencil,
  TrendUp,
  TrendDown,
  Receipt,
  Warning,
} from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { CreditEntryDialog } from "./CreditEntryDialog";
import { usePermissions } from "@/hooks/usePermissions";
import { useOrganization } from "@/contexts/OrganizationContext";
import {
  calculateCreditStatus,
  calculateTripCost,
  type OrganizationFees,
} from "@/lib/credit-utils";

interface PatientCreditTabProps {
  patientId: string;
  patientName: string;
  monthlyCredit: number | null;
  creditUsedFor: string | null;
  notes: string | null;
  referralDate: string | null;
  referralExpiration: string | null;
  serviceType: string | null;
}

interface Trip {
  id: string;
  pickup_time: string;
  status: string;
  trip_type: string;
  pickup_location: string;
  dropoff_location: string;
  actual_distance_miles: number | null;
  distance_miles: number | null;
  total_waiting_minutes: number | null;
}

// Moved to @/lib/credit-utils.ts

export function PatientCreditTab({
  patientId,
  patientName,
  monthlyCredit,
  creditUsedFor,
  notes,
  referralDate,
  referralExpiration,
  serviceType,
}: PatientCreditTabProps) {
  const { isOwner, isAdmin } = usePermissions();
  const { currentOrganization } = useOrganization();
  const canManageCredits = isOwner || isAdmin;

  // Month navigation
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  // Edit dialog
  const [showEditDialog, setShowEditDialog] = useState(false);

  // Month ranges
  const startOfMonth = new Date(
    selectedMonth.getFullYear(),
    selectedMonth.getMonth(),
    1,
  );
  const endOfMonth = new Date(
    selectedMonth.getFullYear(),
    selectedMonth.getMonth() + 1,
    0,
    23,
    59,
    59,
  );
  const daysInMonth = endOfMonth.getDate();

  // Fetch organization fees
  const { data: fees } = useQuery({
    queryKey: ["organization_fees", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return null;
      const { data, error } = await supabase
        .from("organization_fees")
        .select("*")
        .eq("org_id", currentOrganization.id)
        .single();

      if (error && error.code !== "PGRST116") throw error;
      return data as OrganizationFees;
    },
    enabled: !!currentOrganization?.id,
  });

  // Fetch trips for this month
  const { data: trips = [], isLoading } = useQuery({
    queryKey: ["patient-credit-trips", patientId, selectedMonth.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trips")
        .select(
          "id, pickup_time, status, trip_type, pickup_location, dropoff_location, actual_distance_miles, distance_miles, total_waiting_minutes",
        )
        .eq("patient_id", patientId)
        .gte("pickup_time", startOfMonth.toISOString())
        .lte("pickup_time", endOfMonth.toISOString())
        .order("pickup_time", { ascending: true });

      if (error) throw error;
      return data as Trip[];
    },
  });

  // Calculate daily spending and totals
  const { dailySpend, totalSpend, completedTrips } = useMemo(() => {
    const daily: Record<number, number> = {};
    let total = 0;
    let completed = 0;

    trips.forEach((trip) => {
      if (trip.status === "completed") {
        const day = new Date(trip.pickup_time).getDate();
        const cost = calculateTripCost(trip, fees || null);
        daily[day] = (daily[day] || 0) + cost;
        total += cost;
        completed++;
      }
    });

    return { dailySpend: daily, totalSpend: total, completedTrips: completed };
  }, [trips, fees]);

  const creditStatus = calculateCreditStatus(monthlyCredit, totalSpend);
  const remainingBalance = (monthlyCredit || 0) - totalSpend;
  const usagePercentage = monthlyCredit
    ? (totalSpend / monthlyCredit) * 100
    : 0;

  // Month navigation
  const goToPrevMonth = () => {
    setSelectedMonth(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1),
    );
  };

  const goToNextMonth = () => {
    setSelectedMonth(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1),
    );
  };

  const goToCurrentMonth = () => {
    const now = new Date();
    setSelectedMonth(new Date(now.getFullYear(), now.getMonth(), 1));
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const getStatusColor = () => {
    return `${creditStatus.bgClass} ${creditStatus.colorClass}`;
  };

  const getStatusText = () => {
    return creditStatus.label;
  };

  return (
    <div className="space-y-6">
      {/* Credit Summary Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600">
              <CreditCard weight="duotone" className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                Credit Overview
              </h3>
              <p className="text-sm text-slate-500">
                {creditUsedFor || "General Transportation"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-semibold",
                getStatusColor(),
              )}
            >
              {getStatusText()}
            </span>
            {canManageCredits && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowEditDialog(true)}
                className="rounded-xl gap-2"
              >
                <Pencil weight="duotone" className="w-4 h-4" />
                Edit Credit
              </Button>
            )}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
            <p className="text-xs text-slate-500 mb-1">Credit Limit</p>
            <p className="text-xl font-bold text-slate-900">
              {monthlyCredit ? formatCurrency(monthlyCredit) : "—"}
            </p>
          </div>
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendDown weight="bold" className="w-3 h-3 text-slate-500" />
              <p className="text-xs text-slate-500">Total Spent</p>
            </div>
            <p className="text-xl font-bold text-slate-700">
              {formatCurrency(totalSpend)}
            </p>
          </div>
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendUp weight="bold" className="w-3 h-3 text-emerald-500" />
              <p className="text-xs text-slate-500">Remaining</p>
            </div>
            <p
              className={cn(
                "text-xl font-bold",
                remainingBalance >= 0 ? "text-emerald-600" : "text-red-600",
              )}
            >
              {formatCurrency(remainingBalance)}
            </p>
          </div>
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
            <div className="flex items-center gap-1.5 mb-1">
              <Receipt weight="bold" className="w-3 h-3 text-slate-500" />
              <p className="text-xs text-slate-500">Trips</p>
            </div>
            <p className="text-xl font-bold text-slate-700">{completedTrips}</p>
          </div>
        </div>

        {/* Progress Bar */}
        {monthlyCredit && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Usage</span>
              <span className="font-medium text-slate-700">
                {usagePercentage.toFixed(1)}%
              </span>
            </div>
            <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-300",
                  creditStatus.status === "low"
                    ? "bg-red-500"
                    : creditStatus.status === "mid"
                      ? "bg-amber-500"
                      : "bg-emerald-500",
                )}
                style={{ width: `${Math.min(100, usagePercentage)}%` }}
              />
            </div>
          </div>
        )}

        {/* Notes */}
        {notes && (
          <div className="mt-4 p-3 rounded-xl bg-amber-50 border border-amber-100">
            <div className="flex items-start gap-2">
              <Warning
                weight="duotone"
                className="w-4 h-4 text-amber-600 mt-0.5"
              />
              <p className="text-sm text-amber-800">{notes}</p>
            </div>
          </div>
        )}
      </div>

      {/* Monthly Spending Details */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <h3 className="text-lg font-semibold text-slate-900">
            Daily Spending
          </h3>

          {/* Month Navigation */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={goToPrevMonth}
              className="h-8 w-8 p-0"
            >
              <CaretLeft size={16} weight="bold" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={goToCurrentMonth}
              className="h-8 px-3 text-xs font-medium min-w-[140px]"
            >
              <CalendarBlank size={14} weight="duotone" className="mr-2" />
              {selectedMonth.toLocaleDateString("en-US", {
                month: "long",
                year: "numeric",
              })}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={goToNextMonth}
              className="h-8 w-8 p-0"
            >
              <CaretRight size={16} weight="bold" />
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex h-32 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : (
          <>
            {/* Daily Grid - Desktop */}
            <div className="hidden md:block">
              <div className="grid grid-cols-7 gap-1 mb-2">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                  (day) => (
                    <div
                      key={day}
                      className="text-center text-[10px] font-medium text-slate-400 uppercase"
                    >
                      {day}
                    </div>
                  ),
                )}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {/* Empty cells for days before first of month */}
                {Array.from({
                  length: new Date(
                    selectedMonth.getFullYear(),
                    selectedMonth.getMonth(),
                    1,
                  ).getDay(),
                }).map((_, i) => (
                  <div key={`empty-${i}`} className="aspect-square" />
                ))}
                {/* Days of the month */}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1;
                  const spend = dailySpend[day] || 0;
                  const hasSpend = spend > 0;

                  return (
                    <div
                      key={day}
                      className={cn(
                        "aspect-square rounded-lg border flex flex-col items-center justify-center text-xs transition-colors",
                        hasSpend
                          ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                          : "bg-slate-50 border-slate-100 text-slate-400",
                      )}
                    >
                      <span className="font-medium">{day}</span>
                      {hasSpend && (
                        <span className="text-[10px] font-bold">${spend}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Daily List - Mobile */}
            <div className="md:hidden space-y-2">
              {trips.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-sm">
                  No trips this month
                </div>
              ) : (
                trips
                  .filter((t) => t.status === "completed")
                  .map((trip) => {
                    const tripDate = new Date(trip.pickup_time);
                    return (
                      <div
                        key={trip.id}
                        className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-sm">
                            {tripDate.getDate()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-900 truncate">
                              {trip.trip_type}
                            </p>
                            <p className="text-xs text-slate-500 truncate">
                              {tripDate.toLocaleDateString("en-US", {
                                weekday: "short",
                                month: "short",
                                day: "numeric",
                              })}
                            </p>
                          </div>
                        </div>
                        <span className="font-semibold text-emerald-600">
                          {formatCurrency(
                            calculateTripCost(trip, fees || null),
                          )}
                        </span>
                      </div>
                    );
                  })
              )}
            </div>

            {/* Summary Footer */}
            <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-sm text-slate-500">
                {completedTrips} completed trip{completedTrips !== 1 ? "s" : ""}{" "}
                this month
              </span>
              <span className="text-sm font-semibold text-slate-900">
                Total: {formatCurrency(totalSpend)}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Edit Credit Dialog */}
      <CreditEntryDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        patientId={patientId}
        patientName={patientName}
        currentMonthlyCredit={monthlyCredit || 0}
        currentCreditUsedFor={creditUsedFor || ""}
        currentNotes={notes || ""}
        currentReferralDate={referralDate || ""}
        currentReferralExpiration={referralExpiration || ""}
        currentSpend={totalSpend}
        serviceType={serviceType || ""}
        mode="edit"
      />
    </div>
  );
}
