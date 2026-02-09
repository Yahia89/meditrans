import { useState, useMemo } from "react";
import {
  ArrowLeft,
  Calendar,
  Phone,
  Mail,
  MapPin,
  Loader2,
  Pencil,
  ShieldAlert,
  FileText,
  Briefcase,
  CreditCard,
  Trash,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  CaretLeft,
  CaretRight,
  CalendarBlank,
  Funnel,
  Coins,
} from "@phosphor-icons/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { cn, formatPhoneNumber } from "@/lib/utils";
import { usePermissions } from "@/hooks/usePermissions";
import { PatientForm } from "@/components/forms/patient-form";
import { DocumentManager } from "@/components/document-manager";
import { DeleteConfirmationDialog } from "@/components/ui/delete-confirmation-dialog";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { PatientCreditTab } from "@/components/credits/PatientCreditTab";
import type { Trip, TripStatus } from "@/components/trips/types";
import { useAuth } from "@/contexts/auth-context";
import { useOrganization } from "@/contexts/OrganizationContext";
import {
  getActiveTimezone,
  formatInUserTimezone,
  parseZonedTime,
} from "@/lib/timezone";

interface PatientDetailsPageProps {
  id: string;
  onBack: () => void;
  onTripClick?: (id: string) => void;
}

interface Patient {
  id: string;
  org_id: string;
  full_name: string;
  date_of_birth: string | null;
  dob: string | null;
  phone: string | null;
  email: string | null;
  primary_address: string | null;
  county: string | null;
  waiver_type: string | null;
  referral_by: string | null;
  referral_date: string | null;
  referral_expiration_date: string | null;
  service_type: string | null;
  case_manager: string | null;
  case_manager_phone: string | null;
  monthly_credit: number | null;
  credit_used_for: string | null;
  vehicle_type_need: string | null;
  notes: string | null;
  created_at: string;
}

const statusColors: Record<TripStatus, string> = {
  pending: "bg-slate-100 text-slate-700 border-slate-200",
  assigned: "bg-blue-50 text-blue-700 border-blue-100",
  accepted: "bg-indigo-50 text-indigo-700 border-indigo-100",
  en_route: "bg-sky-50 text-sky-700 border-sky-100",
  arrived: "bg-amber-50 text-amber-700 border-amber-100",
  in_progress: "bg-blue-100 text-blue-800 border-blue-200",
  completed: "bg-emerald-50 text-emerald-700 border-emerald-100",
  cancelled: "bg-red-50 text-red-700 border-red-100",
  no_show: "bg-orange-50 text-orange-700 border-orange-100",
  waiting: "bg-amber-100 text-amber-800 border-amber-200",
};

function formatDate(dateStr: string | null, timezone: string = "UTC") {
  if (!dateStr) return "Not specified";

  // Handle YYYY-MM-DD specifically (Birthdays, etc)
  if (
    dateStr.length === 10 &&
    dateStr.includes("-") &&
    !dateStr.includes("T")
  ) {
    return formatInUserTimezone(dateStr, "UTC", "MMMM d, yyyy");
  }

  return formatInUserTimezone(dateStr, timezone, "MMMM d, yyyy");
}

const TRIPS_PER_PAGE = 6;

export function PatientDetailsPage({
  id,
  onBack,
  onTripClick,
}: PatientDetailsPageProps) {
  const [activeTab, setActiveTab] = useState<
    "overview" | "documents" | "trips" | "credits"
  >("overview");
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { profile } = useAuth();
  const { currentOrganization } = useOrganization();
  const { canEditPatients } = usePermissions();
  const { isDemoMode } = useOnboarding();
  const queryClient = useQueryClient();

  const activeTimezone = useMemo(
    () => getActiveTimezone(profile, currentOrganization),
    [profile, currentOrganization],
  );

  // Trip history filtering and pagination state
  const [tripMonth, setTripMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [tripPage, setTripPage] = useState(1);
  const [tripStatusFilter, setTripStatusFilter] = useState<TripStatus | "all">(
    "all",
  );
  const [selectedTripDate, setSelectedTripDate] = useState<Date | null>(null);

  const canManagePatients = canEditPatients;

  // Fetch patient data
  const { data: patient, isLoading: isLoadingPatient } = useQuery({
    queryKey: ["patient", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patients")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      return data as Patient;
    },
    enabled: !!id,
  });

  // Fetch all trips for this patient
  const { data: allTrips = [], isLoading: isLoadingTrips } = useQuery({
    queryKey: ["patient-trips", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trips")
        .select(
          `
          *,
          driver:drivers(id, full_name, phone, vehicle_info)
        `,
        )
        .eq("patient_id", id)
        .order("pickup_time", { ascending: false });

      if (error) throw error;
      return data as Trip[];
    },
    enabled: !!id,
  });

  // Fetch document count
  const { data: docCount = 0 } = useQuery({
    queryKey: ["patient-docs-count", id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("org_uploads")
        .select("*", { count: "exact", head: true })
        .eq("purpose", "patient_document")
        .eq("notes", id);
      if (error) throw error;
      return count || 0;
    },
  });

  // Filter trips by month and status
  const filteredTrips = useMemo(() => {
    // If a specific date is selected, filter by that day
    if (selectedTripDate) {
      const targetDateStr = formatInUserTimezone(
        selectedTripDate,
        activeTimezone,
        "yyyy-MM-dd",
      );
      return allTrips.filter((trip) => {
        const tripDateStr = formatInUserTimezone(
          trip.pickup_time,
          activeTimezone,
          "yyyy-MM-dd",
        );
        const matchesStatus =
          tripStatusFilter === "all" || trip.status === tripStatusFilter;
        return tripDateStr === targetDateStr && matchesStatus;
      });
    }

    // Otherwise show all trips for the selected month
    const monthStr = formatInUserTimezone(tripMonth, activeTimezone, "yyyy-MM");
    const startOfMonthUTC = parseZonedTime(
      `${monthStr}-01`,
      "00:00",
      activeTimezone,
    );

    // Get last day of month
    const year = parseInt(monthStr.split("-")[0]);
    const month = parseInt(monthStr.split("-")[1]);
    const lastDay = new Date(year, month, 0).getDate();
    const endOfMonthUTC = parseZonedTime(
      `${monthStr}-${lastDay}`,
      "23:59:59",
      activeTimezone,
    );

    return allTrips.filter((trip) => {
      const tripDate = new Date(trip.pickup_time);
      const inMonth = tripDate >= startOfMonthUTC && tripDate <= endOfMonthUTC;
      const matchesStatus =
        tripStatusFilter === "all" || trip.status === tripStatusFilter;
      return inMonth && matchesStatus;
    });
  }, [allTrips, tripMonth, tripStatusFilter, selectedTripDate, activeTimezone]);

  // Paginate filtered trips
  const paginatedTrips = useMemo(() => {
    const start = (tripPage - 1) * TRIPS_PER_PAGE;
    return filteredTrips.slice(start, start + TRIPS_PER_PAGE);
  }, [filteredTrips, tripPage]);

  const totalTripPages = Math.ceil(filteredTrips.length / TRIPS_PER_PAGE);

  // Reset to page 1 when filters change
  useMemo(() => {
    setTripPage(1);
  }, [tripMonth, tripStatusFilter, selectedTripDate]);

  const goToPrevMonth = () => {
    setTripMonth(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1),
    );
  };

  const goToNextMonth = () => {
    setTripMonth(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1),
    );
  };

  const goToCurrentMonth = () => {
    const now = new Date();
    setTripMonth(new Date(now.getFullYear(), now.getMonth(), 1));
  };

  const handleDelete = async () => {
    if (isDemoMode) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase.from("patients").delete().eq("id", id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["patients"] });
      onBack();
    } catch (err) {
      console.error("Failed to delete patient:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoadingPatient) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">Patient not found</p>
        <Button variant="link" onClick={onBack}>
          Go back to patients
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <ArrowLeft size={20} className="text-slate-500" />
          </button>
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">
              {patient.full_name}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                Active Patient
              </span>
              <span className="text-xs text-slate-500">
                ID: {patient.id.substring(0, 8)}
              </span>
            </div>
          </div>
        </div>

        {canManagePatients && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setIsEditing(true)}
              className="inline-flex items-center gap-2 rounded-xl"
            >
              <Pencil size={16} />
              Edit Details
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(true)}
              disabled={isDemoMode}
              className="inline-flex items-center gap-2 rounded-xl text-red-600 border-red-100 hover:bg-red-50 hover:text-red-700"
            >
              <Trash size={16} />
              Delete Patient
            </Button>
          </div>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-slate-200 overflow-x-auto scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="flex min-w-max">
          <button
            onClick={() => setActiveTab("overview")}
            className={cn(
              "px-4 sm:px-6 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap",
              activeTab === "overview"
                ? "border-[#3D5A3D] text-[#3D5A3D]"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300",
            )}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab("documents")}
            className={cn(
              "px-4 sm:px-6 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap",
              activeTab === "documents"
                ? "border-[#3D5A3D] text-[#3D5A3D]"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300",
            )}
          >
            Documents
            <span
              className={cn(
                "px-2 py-0.5 rounded-full text-[10px] font-bold",
                activeTab === "documents"
                  ? "bg-[#3D5A3D] text-white"
                  : "bg-slate-100 text-slate-500",
              )}
            >
              {docCount}
            </span>
          </button>
          <button
            onClick={() => setActiveTab("trips")}
            className={cn(
              "px-4 sm:px-6 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap",
              activeTab === "trips"
                ? "border-[#3D5A3D] text-[#3D5A3D]"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300",
            )}
          >
            Trip History
            <span
              className={cn(
                "px-2 py-0.5 rounded-full text-[10px] font-bold",
                activeTab === "trips"
                  ? "bg-[#3D5A3D] text-white"
                  : "bg-slate-100 text-slate-500",
              )}
            >
              {allTrips.length}
            </span>
          </button>
          {/* Credits Tab - show for admins/owners or if patient has credit */}
          {(canManagePatients || patient.monthly_credit) && (
            <button
              onClick={() => setActiveTab("credits")}
              className={cn(
                "px-4 sm:px-6 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap",
                activeTab === "credits"
                  ? "border-[#3D5A3D] text-[#3D5A3D]"
                  : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300",
              )}
            >
              <Coins weight="duotone" className="w-4 h-4" />
              Credits
              {patient.monthly_credit && (
                <span
                  className={cn(
                    "px-2 py-0.5 rounded-full text-[10px] font-bold",
                    activeTab === "credits"
                      ? "bg-[#3D5A3D] text-white"
                      : "bg-emerald-100 text-emerald-700",
                  )}
                >
                  ${patient.monthly_credit.toLocaleString()}
                </span>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content Area */}
          <div className="lg:col-span-2 space-y-6">
            {/* Personal Information */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-900 mb-6">
                Personal Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-slate-50 rounded-lg">
                      <Calendar className="w-5 h-5 text-slate-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">
                        Date of Birth
                      </p>
                      <p className="text-slate-900 mt-0.5">
                        {formatDate(patient.date_of_birth, activeTimezone)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-slate-50 rounded-lg">
                      <Phone className="w-5 h-5 text-slate-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">
                        Phone Number
                      </p>
                      <p className="text-slate-900 mt-0.5">
                        {patient.phone
                          ? formatPhoneNumber(patient.phone)
                          : "Not specified"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-slate-50 rounded-lg">
                      <MapPin className="w-5 h-5 text-slate-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">
                        Primary Address
                      </p>
                      <p className="text-slate-900 mt-0.5">
                        {patient.primary_address || "Not specified"}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-slate-50 rounded-lg">
                      <Mail className="w-5 h-5 text-slate-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">
                        Email Address
                      </p>
                      <p className="text-slate-900 mt-0.5">
                        {patient.email || "Not specified"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-slate-50 rounded-lg">
                      <MapPin className="w-5 h-5 text-slate-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">
                        County
                      </p>
                      <p className="text-slate-900 mt-0.5">
                        {patient.county || "Not specified"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Service & Referral Information */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-900 mb-6">
                Service & Referral
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">
                      Service Type
                    </p>
                    <p className="text-slate-900 mt-1 font-medium">
                      {patient.service_type || "Not specified"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">
                      Waiver Type
                    </p>
                    <p className="text-slate-900 mt-1">
                      {patient.waiver_type || "Not specified"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">
                      Vehicle Need
                    </p>
                    <p className="text-slate-900 mt-1">
                      {patient.vehicle_type_need || "Not specified"}
                    </p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">
                      Referred By
                    </p>
                    <p className="text-slate-900 mt-1">
                      {patient.referral_by || "Not specified"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">
                      Referral Period
                    </p>
                    <p className="text-slate-900 mt-1">
                      {patient.referral_date
                        ? formatDate(patient.referral_date, activeTimezone)
                        : "Start"}
                      <span className="mx-2 text-slate-400">→</span>
                      {patient.referral_expiration_date
                        ? formatDate(
                            patient.referral_expiration_date,
                            activeTimezone,
                          )
                        : "End"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Case Management & Billing */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-slate-400" />
                  Case Management
                </h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-slate-500">Manager Name</p>
                    <p className="text-sm font-medium text-slate-900">
                      {patient.case_manager || "None assigned"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Contact Number</p>
                    <p className="text-sm font-medium text-slate-900">
                      {patient.case_manager_phone
                        ? formatPhoneNumber(patient.case_manager_phone)
                        : "N/A"}
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-slate-400" />
                  Billing Details
                </h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-slate-500">Monthly Credit</p>
                    <p className="text-sm font-bold text-emerald-600">
                      {patient.monthly_credit
                        ? `$${patient.monthly_credit.toFixed(2)}`
                        : "$0.00"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Credit Used For</p>
                    <p className="text-sm text-slate-600">
                      {patient.credit_used_for || "General use"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Medical Notes */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-slate-900">
                  Medical Notes
                </h3>
                <FileText className="w-5 h-5 text-slate-300" />
              </div>
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 min-h-[120px]">
                {patient.notes ? (
                  <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">
                    {patient.notes}
                  </p>
                ) : (
                  <p className="text-slate-400 italic">
                    No notes recorded for this patient.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar - Patient Status merged into overview */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4">
                Patient Status
              </h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between py-2 border-b border-slate-50">
                  <span className="text-sm text-slate-500">Total Trips</span>
                  <span className="text-sm font-semibold text-slate-900">
                    {allTrips.length}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-slate-50">
                  <span className="text-sm text-slate-500">Last Transport</span>
                  <span className="text-sm text-slate-900">
                    {allTrips.length > 0
                      ? formatDate(allTrips[0].pickup_time, activeTimezone)
                      : "Never"}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-slate-500">Added On</span>
                  <span className="text-sm text-slate-900">
                    {formatDate(patient.created_at, activeTimezone)}
                  </span>
                </div>
              </div>
            </div>

            {!canManagePatients && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
                <div className="flex items-center gap-3 text-amber-800 mb-2">
                  <ShieldAlert size={20} />
                  <span className="font-semibold">View Only</span>
                </div>
                <p className="text-sm text-amber-700 leading-relaxed">
                  You have view-only access to this patient's profile. Only
                  administrators and owners can modify details or upload
                  documents.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "documents" && (
        <DocumentManager
          ownerId={id}
          purpose="patient_document"
          source="patients"
        />
      )}

      {activeTab === "trips" && (
        <div className="space-y-6">
          {/* Trip Filters */}
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              {/* Month Navigation - Hide when filtering by specific day */}
              {!selectedTripDate ? (
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
                    <CalendarBlank
                      size={14}
                      weight="duotone"
                      className="mr-2"
                    />
                    {formatInUserTimezone(
                      tripMonth,
                      activeTimezone,
                      "MMMM yyyy",
                    )}
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
              ) : (
                <div className="flex items-center gap-2">
                  <div className="text-sm font-medium text-slate-900 bg-slate-100 px-3 py-1.5 rounded-lg flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-slate-500" />
                    {formatInUserTimezone(
                      selectedTripDate,
                      activeTimezone,
                      "MMMM d, yyyy",
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedTripDate(null)}
                    className="h-8 px-3 text-xs hover:bg-slate-100 text-slate-500"
                  >
                    Show all
                  </Button>
                </div>
              )}

              {/* Status Filter */}
              <div className="flex items-center gap-2">
                <Funnel size={16} className="text-slate-400" />
                <select
                  value={tripStatusFilter}
                  onChange={(e) =>
                    setTripStatusFilter(e.target.value as TripStatus | "all")
                  }
                  className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#3D5A3D]/20"
                >
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="assigned">Assigned</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
                <span className="text-xs text-slate-500">
                  {filteredTrips.length} trip
                  {filteredTrips.length !== 1 ? "s" : ""}
                </span>
              </div>
            </div>
          </div>

          {/* Trip Cards */}
          {isLoadingTrips ? (
            <div className="flex h-48 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
          ) : paginatedTrips.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl border border-dashed border-slate-300 gap-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-slate-50 border border-slate-100">
                <Calendar className="w-6 h-6 text-slate-300" />
              </div>
              <div className="text-center">
                <h3 className="text-base font-semibold text-slate-900">
                  No trips found
                </h3>
                <p className="text-sm text-slate-500">
                  No trips scheduled for{" "}
                  {selectedTripDate
                    ? formatInUserTimezone(
                        selectedTripDate,
                        activeTimezone,
                        "MMMM d, yyyy",
                      )
                    : formatInUserTimezone(
                        tripMonth,
                        activeTimezone,
                        "MMMM yyyy",
                      )}
                  {tripStatusFilter !== "all"
                    ? ` with status "${tripStatusFilter.replace("_", " ")}"`
                    : ""}
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {paginatedTrips.map((trip) => (
                <div
                  key={trip.id}
                  onClick={() => onTripClick?.(trip.id)}
                  className="group bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all cursor-pointer overflow-hidden flex flex-col"
                >
                  {/* Status Header */}
                  <div className="p-4 border-b border-slate-50 flex items-center justify-between">
                    <span
                      className={cn(
                        "px-2.5 py-0.5 rounded-full text-xs font-semibold border",
                        statusColors[trip.status],
                      )}
                    >
                      {trip.status.replace("_", " ").toUpperCase()}
                    </span>
                    <span className="text-xs font-medium text-slate-400">
                      {trip.trip_type}
                    </span>
                  </div>

                  <div className="p-5 space-y-4 flex-1">
                    <div className="flex items-center gap-2 text-slate-600">
                      <Calendar className="w-4 h-4" />
                      <span className="text-sm font-medium">
                        {formatInUserTimezone(
                          trip.pickup_time,
                          activeTimezone,
                          "MMM d, yyyy",
                        )}{" "}
                        at{" "}
                        {formatInUserTimezone(
                          trip.pickup_time,
                          activeTimezone,
                          "h:mm a",
                        )}
                      </span>
                    </div>

                    {/* Locations */}
                    <div className="space-y-2">
                      <div className="flex items-start gap-2 text-slate-600">
                        <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0 text-red-400" />
                        <span className="text-sm line-clamp-1">
                          {trip.pickup_location}
                        </span>
                      </div>
                      <div className="flex items-start gap-2 text-slate-600">
                        <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0 text-emerald-400" />
                        <span className="text-sm line-clamp-1">
                          {trip.dropoff_location}
                        </span>
                      </div>
                    </div>

                    {/* Driver */}
                    <div className="pt-3 border-t border-slate-50 text-xs text-slate-500">
                      Driver: {trip.driver?.full_name || "Unassigned"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalTripPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setTripPage((p) => Math.max(1, p - 1))}
                disabled={tripPage === 1}
                className="h-8 w-8 p-0"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm text-slate-600 px-2">
                Page {tripPage} of {totalTripPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setTripPage((p) => Math.min(totalTripPages, p + 1))
                }
                disabled={tripPage === totalTripPages}
                className="h-8 w-8 p-0"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      )}

      {activeTab === "credits" && (
        <PatientCreditTab
          patientId={patient.id}
          patientName={patient.full_name}
          monthlyCredit={patient.monthly_credit}
          creditUsedFor={patient.credit_used_for}
          notes={patient.notes}
          referralDate={patient.referral_date}
          referralExpiration={patient.referral_expiration_date}
          serviceType={patient.service_type}
          onDayClick={(date) => {
            setSelectedTripDate(date);
            setActiveTab("trips");
          }}
        />
      )}

      {/* Edit Form */}
      <PatientForm
        open={isEditing}
        onOpenChange={setIsEditing}
        initialData={{
          id: patient.id,
          full_name: patient.full_name,
          email: patient.email || "",
          phone: patient.phone || "",
          primary_address: patient.primary_address || "",
          dob: patient.dob || patient.date_of_birth || "",
          county: patient.county || "",
          waiver_type: patient.waiver_type || "",
          referral_by: patient.referral_by || "",
          referral_date: patient.referral_date || "",
          referral_expiration_date: patient.referral_expiration_date || "",
          service_type: patient.service_type || "",
          case_manager: patient.case_manager || "",
          case_manager_phone: patient.case_manager_phone || "",
          monthly_credit: patient.monthly_credit?.toString() || "",
          credit_used_for: patient.credit_used_for || "",
          vehicle_type_need: patient.vehicle_type_need || "",
          notes: patient.notes || "",
        }}
      />

      <DeleteConfirmationDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        onConfirm={handleDelete}
        title="Delete Patient?"
        description="This action cannot be undone. This will permanently delete the patient and all associated data"
        itemName={patient.full_name}
        isDeleting={isDeleting}
      />
    </div>
  );
}
