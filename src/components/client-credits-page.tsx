"use client";

import { useState, useMemo, useEffect } from "react";
import {
  CreditCard,
  Warning,
  CaretLeft,
  CaretRight,
  CalendarBlank,
  MagnifyingGlass,
  ArrowsDownUp,
  User,
  Notepad,
  Check,
  X,
  Bell,
  Funnel,
  Pencil,
  Plus,
} from "@phosphor-icons/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { CreditEntryDialog } from "@/components/credits/CreditEntryDialog";
import { AddPatientToCreditDialog } from "@/components/credits/AddPatientToCreditDialog";
import { usePermissions } from "@/hooks/usePermissions";
import { useTimezone } from "@/hooks/useTimezone";
import { formatInUserTimezone } from "@/lib/timezone";

import {
  calculateCreditStatus,
  calculateTripCost,
  type OrganizationFees,
  type CreditInfo,
} from "@/lib/credit-utils";

interface Patient {
  id: string;
  full_name: string;
  monthly_credit: number | null;
  credit_used_for: string | null;
  service_type: string | null;
  referral_date: string | null;
  referral_expiration_date: string | null;
  notes: string | null;
  phone: string | null;
  email: string | null;
  status: string;
}

interface Trip {
  id: string;
  patient_id: string;
  pickup_time: string;
  status: string;
  trip_type: string;
  actual_distance_miles: number | null;
  distance_miles: number | null;
  total_waiting_minutes: number | null;
  billing_details?: {
    service_type?: string;
  } | null;
}

interface PatientCreditData {
  patient: Patient;
  monthlyCredit: number;
  totalSpend: number;
  remainingBalance: number;
  tripCount: number;
  creditInfo: CreditInfo;
  isPending: boolean;
}

export function ClientCreditsPage() {
  const { currentOrganization } = useOrganization();
  const queryClient = useQueryClient();
  const { isOwner, isAdmin } = usePermissions();
  const activeTimezone = useTimezone();
  const canManageCredits = isOwner || isAdmin;

  // Month navigation
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  // Search and filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<
    "all" | "low" | "medium" | "good" | "pending"
  >("all");
  const [sortBy, setSortBy] = useState<"name" | "balance" | "spend">("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // Editing notes
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [tempNotes, setTempNotes] = useState("");
  const [isSavingNotes, setIsSavingNotes] = useState(false);

  // Alerts
  const [showAlerts, setShowAlerts] = useState(false);

  // Credit dialog
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [showCreditDialog, setShowCreditDialog] = useState(false);

  // Add patient dialog
  const [showAddPatientDialog, setShowAddPatientDialog] = useState(false);

  // Fetch patients with credit info
  const { data: patients = [], isLoading: isLoadingPatients } = useQuery({
    queryKey: ["patients-credits", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      const { data, error } = await supabase
        .from("patients")
        .select(
          "id, full_name, monthly_credit, credit_used_for, referral_date, notes, phone, email, status, service_type",
        )
        .eq("org_id", currentOrganization.id)
        .not("monthly_credit", "is", null);

      if (error) throw error;
      return data as Patient[];
    },
    enabled: !!currentOrganization?.id,
  });

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

  // Fetch trips for the selected month
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

  const { data: trips = [], isLoading: isLoadingTrips } = useQuery({
    queryKey: [
      "trips-credits",
      currentOrganization?.id,
      selectedMonth.toISOString(),
    ],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      const { data, error } = await supabase
        .from("trips")
        .select(
          "id, patient_id, pickup_time, status, trip_type, actual_distance_miles, distance_miles, total_waiting_minutes, billing_details",
        )
        .eq("org_id", currentOrganization.id)
        .gte("pickup_time", startOfMonth.toISOString())
        .lte("pickup_time", endOfMonth.toISOString());

      if (error) throw error;
      return data as Trip[];
    },
    enabled: !!currentOrganization?.id,
  });

  // Real-time subscriptions for live updates
  useEffect(() => {
    if (!currentOrganization?.id) return;

    // Subscribe to patient changes (for credit updates)
    const patientsChannel = supabase
      .channel("patients-credits-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "patients",
          filter: `org_id=eq.${currentOrganization.id}`,
        },
        () => {
          // Invalidate and refetch patient data
          queryClient.invalidateQueries({
            queryKey: ["patients-credits", currentOrganization.id],
          });
        },
      )
      .subscribe();

    // Subscribe to trip changes (for spend tracking)
    const tripsChannel = supabase
      .channel("trips-credits-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "trips",
          filter: `org_id=eq.${currentOrganization.id}`,
        },
        () => {
          // Invalidate and refetch trip data
          queryClient.invalidateQueries({
            queryKey: ["trips-credits", currentOrganization.id],
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(patientsChannel);
      supabase.removeChannel(tripsChannel);
    };
  }, [currentOrganization?.id, queryClient]);

  // Calculate credit data for each patient
  const creditData = useMemo((): PatientCreditData[] => {
    return patients.map((patient) => {
      const patientTrips = trips.filter(
        (t) => t.patient_id === patient.id && t.status === "completed",
      );

      // Calculate total spend using organization fees
      const totalSpend = patientTrips.reduce(
        (sum, trip) => sum + calculateTripCost(trip, fees || null),
        0,
      );

      const monthlyCredit = patient.monthly_credit || 0;
      const remainingBalance = monthlyCredit - totalSpend;
      const creditInfo = calculateCreditStatus(monthlyCredit, totalSpend);
      const isPending =
        patient.notes?.toLowerCase().includes("pending") || false;

      return {
        patient: {
          ...patient,
          referral_expiration_date: patient.referral_expiration_date || null,
        },
        monthlyCredit,
        totalSpend,
        remainingBalance,
        tripCount: patientTrips.length,
        creditInfo,
        isPending,
      };
    });
  }, [patients, trips]);

  // Filter and sort credit data
  const filteredData = useMemo(() => {
    let result = creditData;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (d) =>
          d.patient.full_name.toLowerCase().includes(query) ||
          d.patient.email?.toLowerCase().includes(query) ||
          d.patient.phone?.includes(query),
      );
    }

    // Status filter
    if (filterStatus === "low") {
      result = result.filter((d) => d.creditInfo.status === "low");
    } else if (filterStatus === "medium") {
      result = result.filter((d) => d.creditInfo.status === "mid");
    } else if (filterStatus === "good") {
      result = result.filter(
        (d) => d.creditInfo.status === "good" && !d.isPending,
      );
    } else if (filterStatus === "pending") {
      result = result.filter((d) => d.isPending);
    }

    // Sort
    result.sort((a, b) => {
      let comparison = 0;
      if (sortBy === "name") {
        comparison = a.patient.full_name.localeCompare(b.patient.full_name);
      } else if (sortBy === "balance") {
        comparison = a.remainingBalance - b.remainingBalance;
      } else if (sortBy === "spend") {
        comparison = a.totalSpend - b.totalSpend;
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });

    return result;
  }, [creditData, searchQuery, filterStatus, sortBy, sortOrder]);

  // Low balance alerts
  const lowBalancePatients = useMemo(
    () => creditData.filter((d) => d.creditInfo.status === "low"),
    [creditData],
  );

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

  // Save notes
  const handleSaveNotes = async (patientId: string) => {
    setIsSavingNotes(true);
    try {
      const { error } = await supabase
        .from("patients")
        .update({ notes: tempNotes || null })
        .eq("id", patientId);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["patients-credits"] });
      setEditingNotes(null);
      setTempNotes("");
    } catch (err) {
      console.error("Failed to save notes:", err);
    } finally {
      setIsSavingNotes(false);
    }
  };

  // Start editing notes
  const startEditNotes = (patient: Patient) => {
    setEditingNotes(patient.id);
    setTempNotes(patient.notes || "");
  };

  // Cancel editing
  const cancelEditNotes = () => {
    setEditingNotes(null);
    setTempNotes("");
  };

  // Summary stats
  const summaryStats = useMemo(() => {
    const totalCredit = creditData.reduce((sum, d) => sum + d.monthlyCredit, 0);
    const totalSpend = creditData.reduce((sum, d) => sum + d.totalSpend, 0);
    const totalRemaining = creditData.reduce(
      (sum, d) => sum + d.remainingBalance,
      0,
    );

    return {
      totalClients: creditData.length,
      totalCredit,
      totalSpend,
      totalRemaining,
      lowBalanceCount: lowBalancePatients.length,
    };
  }, [creditData, lowBalancePatients]);

  const isLoading = isLoadingPatients || isLoadingTrips;

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  // Format date
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "N/A";
    return formatInUserTimezone(dateStr, activeTimezone, "MMM d, yyyy");
  };

  // Get balance status color
  const getBalanceColor = (data: PatientCreditData) => {
    if (data.isPending) return "text-amber-600 bg-amber-50 border-amber-200";
    return cn(
      data.creditInfo.colorClass,
      data.creditInfo.bgClass,
      data.creditInfo.colorClass
        .replace("text-", "border-")
        .replace("700", "200"),
    );
  };

  const getProgressColor = (data: PatientCreditData) => {
    if (data.isPending) return "bg-amber-500";
    const status = data.creditInfo.status;
    if (status === "low" || data.remainingBalance < 0) return "bg-red-500";
    if (status === "mid") return "bg-amber-500";
    return "bg-emerald-500";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-[#3D5A3D] text-white shadow-sm">
            <CreditCard weight="duotone" className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              Client Credits Tracker
            </h1>
            <p className="text-sm font-medium text-slate-500">
              Monitor monthly credit usage and balances
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Add Patient Button */}
          {canManageCredits && (
            <Button
              onClick={() => setShowAddPatientDialog(true)}
              className="rounded-xl bg-slate-900 text-white hover:bg-slate-800 gap-2 shadow-sm"
              size="sm"
            >
              <Plus weight="bold" className="w-4 h-4" />
              <span className="hidden sm:inline">Add Patient</span>
            </Button>
          )}

          {/* Alerts Button */}
          {lowBalancePatients.length > 0 && (
            <Button
              variant={showAlerts ? "default" : "outline"}
              onClick={() => setShowAlerts(!showAlerts)}
              className={cn(
                "relative rounded-xl gap-2",
                showAlerts &&
                  "bg-red-500 hover:bg-red-600 text-white border-red-500",
              )}
            >
              <Bell weight="duotone" className="w-4 h-4" />
              Low Balance Alerts
              <span className="ml-1 px-1.5 py-0.5 text-xs font-bold rounded-full bg-white/20">
                {lowBalancePatients.length}
              </span>
            </Button>
          )}
        </div>
      </div>

      {/* Alerts Panel */}
      {showAlerts && lowBalancePatients.length > 0 && (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Warning weight="duotone" className="w-5 h-5 text-red-600" />
            <h3 className="font-bold text-slate-900 uppercase tracking-wider text-xs">
              Low Balance Alerts
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {lowBalancePatients.map((data) => (
              <div
                key={data.patient.id}
                className="flex items-center gap-3 p-3 bg-white rounded-xl border border-red-100"
              >
                <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                  <User weight="duotone" className="w-4 h-4 text-red-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900 truncate">
                    {data.patient.full_name}
                  </p>
                  <p className="text-xs text-red-600">
                    {formatCurrency(data.remainingBalance)} remaining
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: "Total Clients",
            value: summaryStats.totalClients,
            color: "text-slate-900",
          },
          {
            label: "Total Credit",
            value: formatCurrency(summaryStats.totalCredit),
            color: "text-[#3D5A3D]",
          },
          {
            label: "Total Spent",
            value: formatCurrency(summaryStats.totalSpend),
            color: "text-slate-900",
          },
          {
            label: "Total Remaining",
            value: formatCurrency(summaryStats.totalRemaining),
            color:
              summaryStats.totalRemaining >= 0
                ? "text-emerald-700"
                : "text-red-700",
          },
        ].map((card, i) => (
          <div
            key={i}
            className="bg-white rounded-[1.2rem] border border-slate-200 p-6 shadow-sm flex flex-col justify-between min-h-[120px]"
          >
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-4">
              {card.label}
            </p>
            <p
              className={cn(
                "text-2xl md:text-3xl font-black tracking-tight font-mono",
                card.color,
              )}
            >
              {card.value}
            </p>
          </div>
        ))}
      </div>

      {/* Filters and Month Navigation */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Month Navigation */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={goToPrevMonth}
              className="h-9 w-9 p-0"
            >
              <CaretLeft size={18} weight="bold" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={goToCurrentMonth}
              className="h-9 px-4 text-sm font-medium min-w-[160px]"
            >
              <CalendarBlank size={16} weight="duotone" className="mr-2" />
              {formatInUserTimezone(selectedMonth, activeTimezone, "MMMM yyyy")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={goToNextMonth}
              className="h-9 w-9 p-0"
            >
              <CaretRight size={18} weight="bold" />
            </Button>
          </div>

          {/* Search and Filters */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative">
              <MagnifyingGlass
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                placeholder="Search clients..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 w-full sm:w-64 pl-10 pr-4 rounded-lg border border-slate-200 bg-slate-50 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <Funnel size={16} className="text-slate-400" />
              <select
                value={filterStatus}
                onChange={(e) =>
                  setFilterStatus(e.target.value as typeof filterStatus)
                }
                className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              >
                <option value="all">All Status</option>
                <option value="good">Good Standing</option>
                <option value="medium">Medium Balance</option>
                <option value="low">Low Balance</option>
                <option value="pending">Pending</option>
              </select>
            </div>

            {/* Sort */}
            <div className="flex items-center gap-2">
              <ArrowsDownUp size={16} className="text-slate-400" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              >
                <option value="name">Name</option>
                <option value="balance">Balance</option>
                <option value="spend">Spending</option>
              </select>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  setSortOrder(sortOrder === "asc" ? "desc" : "asc")
                }
                className="h-9 w-9 p-0"
              >
                <ArrowsDownUp
                  size={16}
                  className={cn(
                    "transition-transform",
                    sortOrder === "desc" && "rotate-180",
                  )}
                />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Credits Table */}
      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      ) : filteredData.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-dashed border-slate-300 gap-4">
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-slate-50 border border-slate-100">
            <CreditCard weight="duotone" className="w-8 h-8 text-slate-300" />
          </div>
          <div className="text-center">
            <h3 className="text-lg font-semibold text-slate-900">
              No clients with credits
            </h3>
            <p className="text-sm text-slate-500 max-w-md">
              {searchQuery || filterStatus !== "all"
                ? "No clients match your search or filter criteria."
                : "Add monthly credit limits to patients to start tracking their usage."}
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden lg:block bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <th className="text-left py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Client
                    </th>
                    <th className="text-left py-4 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Referral Date
                    </th>
                    <th className="text-right py-4 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Credit Limit
                    </th>
                    <th className="text-right py-4 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Trips
                    </th>
                    <th className="text-right py-4 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Total Spend
                    </th>
                    <th className="text-right py-4 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Remaining
                    </th>
                    <th className="text-center py-4 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="text-left py-4 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Notes
                    </th>
                    {canManageCredits && (
                      <th className="text-center py-4 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredData.map((data) => (
                    <tr
                      key={data.patient.id}
                      className="hover:bg-slate-50/50 transition-colors"
                    >
                      {/* Client */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center flex-shrink-0">
                            <User
                              weight="duotone"
                              className="w-5 h-5 text-slate-500"
                            />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-slate-900 truncate">
                              {data.patient.full_name}
                            </p>
                            <p className="text-xs text-slate-500 truncate">
                              {data.patient.email ||
                                data.patient.phone ||
                                "No contact"}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Referral Date */}
                      <td className="py-4 px-4 text-sm text-slate-600">
                        {formatDate(data.patient.referral_date)}
                      </td>

                      {/* Credit Limit */}
                      <td className="py-4 px-4 text-right">
                        <span className="font-semibold text-slate-900">
                          {formatCurrency(data.monthlyCredit)}
                        </span>
                      </td>

                      {/* Trips */}
                      <td className="py-4 px-4 text-right text-sm text-slate-600">
                        {data.tripCount}
                      </td>

                      {/* Total Spend */}
                      <td className="py-4 px-4 text-right">
                        <span className="font-medium text-slate-700">
                          {formatCurrency(data.totalSpend)}
                        </span>
                      </td>

                      {/* Remaining */}
                      <td className="py-4 px-4 text-right">
                        <span
                          className={cn(
                            "font-bold",
                            data.remainingBalance >= 0
                              ? "text-emerald-600"
                              : "text-red-600",
                          )}
                        >
                          {formatCurrency(data.remainingBalance)}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4">
                        <div className="flex flex-col items-center gap-1.5 min-w-[80px]">
                          <span
                            className={cn(
                              "px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold border whitespace-nowrap",
                              getBalanceColor(data),
                            )}
                          >
                            {data.isPending
                              ? "PENDING"
                              : data.creditInfo.label.toUpperCase()}
                          </span>
                          {/* Progress bar */}
                          <div className="w-12 sm:w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={cn(
                                "h-full transition-all rounded-full",
                                getProgressColor(data),
                              )}
                              style={{
                                width: `${Math.max(
                                  0,
                                  Math.min(
                                    100,
                                    (data.remainingBalance /
                                      data.monthlyCredit) *
                                      100,
                                  ),
                                )}%`,
                              }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Notes */}
                      <td className="py-4 px-6">
                        {editingNotes === data.patient.id ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={tempNotes}
                              onChange={(e) => setTempNotes(e.target.value)}
                              placeholder="Add notes..."
                              className="flex-1 min-w-0 h-8 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                              autoFocus
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleSaveNotes(data.patient.id)}
                              disabled={isSavingNotes}
                              className="h-8 w-8 p-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                            >
                              <Check size={16} weight="bold" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={cancelEditNotes}
                              disabled={isSavingNotes}
                              className="h-8 w-8 p-0 text-slate-400 hover:text-slate-600"
                            >
                              <X size={16} weight="bold" />
                            </Button>
                          </div>
                        ) : (
                          <button
                            onClick={() => startEditNotes(data.patient)}
                            className="group flex items-center gap-2 text-left w-full"
                          >
                            <span
                              className={cn(
                                "text-sm truncate max-w-[200px]",
                                data.patient.notes
                                  ? "text-slate-700"
                                  : "text-slate-400 italic",
                              )}
                            >
                              {data.patient.notes || "Click to add notes..."}
                            </span>
                            <Notepad
                              size={14}
                              className="text-slate-300 group-hover:text-slate-500 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            />
                          </button>
                        )}
                      </td>

                      {/* Actions */}
                      {canManageCredits && (
                        <td className="py-4 px-4">
                          <div className="flex items-center justify-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingPatient(data.patient);
                                setShowCreditDialog(true);
                              }}
                              className="h-8 w-8 p-0 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50"
                            >
                              <Pencil weight="duotone" className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Cards */}
          <div className="lg:hidden grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filteredData.map((data) => (
              <div
                key={data.patient.id}
                className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"
              >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
                      <User
                        weight="duotone"
                        className="w-5 h-5 text-slate-500"
                      />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">
                        {data.patient.full_name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {formatDate(data.patient.referral_date)}
                      </p>
                    </div>
                  </div>
                  <span
                    className={cn(
                      "px-2.5 py-1 rounded-full text-xs font-semibold border",
                      getBalanceColor(data),
                    )}
                  >
                    {data.isPending
                      ? "PENDING"
                      : data.creditInfo.label.toUpperCase()}
                  </span>
                </div>

                {/* Stats */}
                <div className="p-4 space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-500">Credit Limit</span>
                    <span className="font-semibold text-slate-900">
                      {formatCurrency(data.monthlyCredit)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-500">
                      Spent ({data.tripCount} trips)
                    </span>
                    <span className="font-medium text-slate-700">
                      {formatCurrency(data.totalSpend)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-500">Remaining</span>
                    <span
                      className={cn(
                        "font-bold",
                        data.remainingBalance >= 0
                          ? "text-emerald-600"
                          : "text-red-600",
                      )}
                    >
                      {formatCurrency(data.remainingBalance)}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full transition-all rounded-full",
                        getProgressColor(data),
                      )}
                      style={{
                        width: `${Math.max(
                          0,
                          Math.min(
                            100,
                            (data.remainingBalance / data.monthlyCredit) * 100,
                          ),
                        )}%`,
                      }}
                    />
                  </div>
                </div>

                {/* Notes */}
                <div className="px-4 pb-4">
                  {editingNotes === data.patient.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={tempNotes}
                        onChange={(e) => setTempNotes(e.target.value)}
                        placeholder="Add notes..."
                        className="flex-1 min-w-0 h-9 px-3 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                        autoFocus
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSaveNotes(data.patient.id)}
                        disabled={isSavingNotes}
                        className="h-9 w-9 p-0 text-emerald-600"
                      >
                        <Check size={18} weight="bold" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={cancelEditNotes}
                        disabled={isSavingNotes}
                        className="h-9 w-9 p-0 text-slate-400"
                      >
                        <X size={18} weight="bold" />
                      </Button>
                    </div>
                  ) : (
                    <button
                      onClick={() => startEditNotes(data.patient)}
                      className="w-full p-3 bg-slate-50 rounded-lg border border-slate-100 text-left group"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={cn(
                            "text-sm truncate",
                            data.patient.notes
                              ? "text-slate-700"
                              : "text-slate-400 italic",
                          )}
                        >
                          {data.patient.notes || "Tap to add notes..."}
                        </span>
                        <Notepad
                          size={16}
                          className="text-slate-300 group-hover:text-slate-500 flex-shrink-0"
                        />
                      </div>
                    </button>
                  )}
                </div>

                {/* Mobile Edit Credit Button */}
                {canManageCredits && (
                  <div className="px-4 pb-4 pt-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingPatient(data.patient);
                        setShowCreditDialog(true);
                      }}
                      className="w-full rounded-lg gap-2 h-10 text-slate-600 hover:text-emerald-600 hover:border-emerald-200 hover:bg-emerald-50"
                    >
                      <Pencil weight="duotone" className="w-4 h-4" />
                      Edit Credit Settings
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Credit Entry Dialog */}
      {editingPatient && (
        <CreditEntryDialog
          open={showCreditDialog}
          onOpenChange={(open) => {
            setShowCreditDialog(open);
            if (!open) setEditingPatient(null);
          }}
          patientId={editingPatient.id}
          patientName={editingPatient.full_name}
          currentMonthlyCredit={editingPatient.monthly_credit || 0}
          currentCreditUsedFor={editingPatient.credit_used_for || ""}
          currentNotes={editingPatient.notes || ""}
          currentReferralDate={editingPatient.referral_date || ""}
          currentReferralExpiration={
            editingPatient.referral_expiration_date || ""
          }
          currentSpend={
            creditData.find((d) => d.patient.id === editingPatient.id)
              ?.totalSpend || 0
          }
          serviceType={editingPatient.service_type || ""}
          mode="edit"
        />
      )}

      {/* Add Patient Dialog */}
      <AddPatientToCreditDialog
        open={showAddPatientDialog}
        onOpenChange={setShowAddPatientDialog}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["patients-credits"] });
          queryClient.invalidateQueries({ queryKey: ["low-balance-patients"] });
        }}
      />
    </div>
  );
}
