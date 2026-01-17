import { useState, useMemo } from "react";
import {
  MagnifyingGlass,
  Plus,
  DotsThreeVertical,
  Phone,
  Envelope,
  MapPin,
  CalendarBlank,
  Funnel,
  DownloadSimple,
  CloudArrowUp,
  List,
  GridFour,
  CaretLeft,
  CaretRight,
} from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { PatientsEmptyState } from "@/components/ui/empty-state";
import { PatientForm } from "@/components/forms/patient-form";
import { Loader2, Pencil, Trash, Check } from "lucide-react";
import { exportToExcel } from "@/lib/export";
import { usePermissions } from "@/hooks/usePermissions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useQueryClient } from "@tanstack/react-query";
import { DeleteConfirmationDialog } from "@/components/ui/delete-confirmation-dialog";
import { Checkbox } from "@/components/ui/checkbox";

interface Patient {
  id: string;
  name: string;
  age: number;
  phone: string;
  email: string;
  address: string;
  lastVisit: string;
  status: "active" | "inactive";
  totalTrips: number;
  date_of_birth?: string | null;
  notes?: string | null;
  custom_fields?: Record<string, string> | null;
  county?: string | null;
  waiver_type?: string | null;
  referral_by?: string | null;
  referral_date?: string | null;
  referral_expiration_date?: string | null;
  service_type?: string | null;
  case_manager?: string | null;
  case_manager_phone?: string | null;
  case_manager_email?: string | null;
  monthly_credit?: number | null;
  credit_used_for?: string | null;
  vehicle_type_need?: string | null;
}

// Demo data for preview mode
const demoPatients: Patient[] = [
  {
    id: "1",
    name: "John Smith",
    age: 68,
    phone: "(555) 123-4567",
    email: "john.smith@email.com",
    address: "123 Main St, Springfield",
    lastVisit: "2024-03-15",
    status: "active",
    totalTrips: 24,
  },
  {
    id: "2",
    name: "Sarah Johnson",
    age: 72,
    phone: "(555) 234-5678",
    email: "sarah.j@email.com",
    address: "456 Oak Ave, Springfield",
    lastVisit: "2024-03-14",
    status: "active",
    totalTrips: 18,
  },
  {
    id: "3",
    name: "Robert Brown",
    age: 65,
    phone: "(555) 345-6789",
    email: "r.brown@email.com",
    address: "789 Pine Rd, Springfield",
    lastVisit: "2024-03-10",
    status: "active",
    totalTrips: 31,
  },
  {
    id: "4",
    name: "Emily Davis",
    age: 70,
    phone: "(555) 456-7890",
    email: "emily.d@email.com",
    address: "321 Elm St, Springfield",
    lastVisit: "2024-02-28",
    status: "inactive",
    totalTrips: 12,
  },
  {
    id: "5",
    name: "Michael Wilson",
    age: 75,
    phone: "(555) 567-8901",
    email: "m.wilson@email.com",
    address: "654 Maple Dr, Springfield",
    lastVisit: "2024-03-12",
    status: "active",
    totalTrips: 27,
  },
];

const ITEMS_PER_PAGE = 5;

// Inline stat component matching reference design
function InlineStat({
  label,
  value,
  valueColor = "text-slate-900",
}: {
  label: string;
  value: string | number;
  valueColor?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm text-slate-500">{label}</span>
      <span className={cn("text-2xl font-semibold tracking-tight", valueColor)}>
        {value}
      </span>
    </div>
  );
}

// Zero stat for empty state
function ZeroStat({ label }: { label: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-2xl font-semibold tracking-tight text-slate-300">
        0
      </span>
    </div>
  );
}

// Demo mode indicator badge
function DemoIndicator() {
  return (
    <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
      Demo Data
    </span>
  );
}

export function PatientsPage({
  onPatientClick,
}: {
  onPatientClick?: (id: string) => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const { isDemoMode, navigateTo } = useOnboarding();
  const { currentOrganization } = useOrganization();
  const { canEditPatients } = usePermissions();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const queryClient = useQueryClient();
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0 || isDemoMode) return;
    setIsDeleting(true);

    try {
      const { error } = await supabase
        .from("patients")
        .delete()
        .in("id", Array.from(selectedIds));

      if (error) throw error;

      queryClient.invalidateQueries({
        queryKey: ["patients", currentOrganization?.id],
      });
      setSelectedIds(new Set());
      setShowBulkDeleteDialog(false);
    } catch (err) {
      console.error("Failed to delete patients:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  // View and pagination state
  const [viewMode, setViewMode] = useState<"bento" | "list">("bento");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Use permission flag for patient management (admin+ only)
  const canManagePatients = canEditPatients;

  const { data: realPatients, isLoading } = useQuery({
    queryKey: ["patients", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization) return [];

      const { data, error } = await supabase
        .from("patients")
        .select("*")
        .eq("org_id", currentOrganization.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return data.map((p) => {
        // Calculate age from DOB
        let age = 0;
        if (p.date_of_birth) {
          const dob = new Date(p.date_of_birth);
          const diff = Date.now() - dob.getTime();
          age = Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
        }

        return {
          id: p.id,
          name: p.full_name,
          age: age,
          phone: p.phone || "",
          email: p.email || "",
          address: p.primary_address || "",
          lastVisit: p.created_at, // Using created_at as proxy for now
          status: (p.status || "active").toLowerCase() as "active" | "inactive",
          totalTrips: 0, // Placeholder
          date_of_birth: p.date_of_birth,
          notes: p.notes,
          custom_fields: p.custom_fields,
          county: p.county,
          waiver_type: p.waiver_type,
          referral_by: p.referral_by,
          referral_date: p.referral_date,
          referral_expiration_date: p.referral_expiration_date,
          service_type: p.service_type,
          case_manager: p.case_manager,
          case_manager_phone: p.case_manager_phone,
          case_manager_email: p.case_manager_email,
          monthly_credit: p.monthly_credit,
          credit_used_for: p.credit_used_for,
          vehicle_type_need: p.vehicle_type_need,
        } as Patient;
      });
    },
    enabled: !!currentOrganization,
  });

  const handleExport = () => {
    if (!patients.length) return;
    // Export with columns matching user's naming convention
    const exportData = patients.map((p) => ({
      "CLIENT NAME": p.name,
      DOB: p.date_of_birth || "",
      "PHONE NUMBER": p.phone,
      ADDRESS: p.address,
      "WAIVER TYPE": p.waiver_type || "",
      COUNTY: p.county || "",
      "REFERRAL BY": "", // Would need to fetch from data
      "MONTHLY CREDIT": "", // Would need to fetch from data
      "CASE MANAGER NAME": p.case_manager || "",
      "SERVICE TYPE": p.service_type || "",
      "VEHICLE NEED": p.vehicle_type_need || "",
      NOTES: p.notes || "",
      Status: p.status,
      "Total Trips": p.totalTrips,
    }));
    exportToExcel(
      exportData,
      `patients_${new Date().toISOString().split("T")[0]}`,
    );
  };

  const handleDeletePatient = async () => {
    if (!deleteId || isDemoMode) return;
    setIsDeleting(true);

    try {
      const { error } = await supabase
        .from("patients")
        .delete()
        .eq("id", deleteId);
      if (error) throw error;
      queryClient.invalidateQueries({
        queryKey: ["patients", currentOrganization?.id],
      });
      setDeleteId(null);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(deleteId);
        return next;
      });
    } catch (err) {
      console.error("Failed to delete patient:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  const hasRealData = realPatients && realPatients.length > 0;
  const showData = hasRealData || isDemoMode;
  const patients = hasRealData ? realPatients : isDemoMode ? demoPatients : [];

  const filteredPatients = useMemo(() => {
    return patients.filter((patient) => {
      const nameMatch = (patient.name || "")
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
      const emailMatch = (patient.email || "")
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
      const phoneMatch = (patient.phone || "").includes(searchQuery);
      return nameMatch || emailMatch || phoneMatch;
    });
  }, [patients, searchQuery]);

  // Pagination
  const totalPages = Math.ceil(filteredPatients.length / ITEMS_PER_PAGE);
  const paginatedPatients = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredPatients.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredPatients, currentPage]);

  // Reset to page 1 when search changes
  useMemo(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const activeCount = patients.filter((p) => p.status === "active").length;
  const totalTrips = patients.reduce((sum, p) => sum + p.totalTrips, 0);

  // Multi-select handlers
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(paginatedPatients.map((p) => p.id)));
  };

  const selectNone = () => {
    setSelectedIds(new Set());
  };

  const isAllSelected =
    paginatedPatients.length > 0 &&
    paginatedPatients.every((p) => selectedIds.has(p.id));

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  // Show empty state if no real data and not in demo mode
  if (!showData) {
    return (
      <div className="space-y-6">
        {/* Patient Form (Add/Edit) */}
        <PatientForm
          open={showAddForm || !!editingPatient}
          onOpenChange={(open) => {
            if (!open) {
              setShowAddForm(false);
              setEditingPatient(null);
            }
          }}
          initialData={
            editingPatient
              ? {
                  id: editingPatient.id,
                  full_name: editingPatient.name,
                  email: editingPatient.email,
                  phone: editingPatient.phone,
                  primary_address: editingPatient.address,
                  dob: editingPatient.date_of_birth || "",
                  county: editingPatient.county || "",
                  waiver_type: editingPatient.waiver_type || "",
                  referral_by: editingPatient.referral_by || "",
                  referral_date: editingPatient.referral_date || "",
                  referral_expiration_date:
                    editingPatient.referral_expiration_date || "",
                  service_type: editingPatient.service_type || "",
                  case_manager: editingPatient.case_manager || "",
                  case_manager_phone: editingPatient.case_manager_phone || "",
                  case_manager_email: editingPatient.case_manager_email || "",
                  monthly_credit:
                    editingPatient.monthly_credit?.toString() || "",
                  credit_used_for: editingPatient.credit_used_for || "",
                  vehicle_type_need: editingPatient.vehicle_type_need || "",
                  notes: editingPatient.notes || "",
                  custom_fields: editingPatient.custom_fields,
                }
              : undefined
          }
        />

        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold text-slate-900">Clients</h1>
            <p className="text-sm text-slate-500">
              Manage and view all client records
            </p>
          </div>
        </div>

        {/* Stats Row with zeros */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4 divide-x divide-slate-100">
            <div className="pl-0">
              <ZeroStat label="Total Clients" />
            </div>
            <div className="pl-8">
              <ZeroStat label="Active" />
            </div>
            <div className="pl-8">
              <ZeroStat label="New This Month" />
            </div>
            <div className="pl-8">
              <ZeroStat label="Total Trips" />
            </div>
          </div>
        </div>

        {/* Empty State */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <PatientsEmptyState
            onAddPatient={() => setShowAddForm(true)}
            onUpload={() => navigateTo("upload")}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center">
            <h1 className="text-2xl font-semibold text-slate-900">Clients</h1>
            {isDemoMode && <DemoIndicator />}
          </div>
          <p className="text-sm text-slate-500">
            Manage and view all client records
          </p>
        </div>
        {canManagePatients && (
          <Button
            onClick={() => setShowAddForm(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-[#3D5A3D] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-[#2E4A2E]"
          >
            <Plus size={18} weight="bold" />
            Add Client
          </Button>
        )}
      </div>

      {/* Patient Form (Add/Edit) */}
      <PatientForm
        open={showAddForm || !!editingPatient}
        onOpenChange={(open) => {
          if (!open) {
            setShowAddForm(false);
            setEditingPatient(null);
          }
        }}
        initialData={
          editingPatient
            ? {
                id: editingPatient.id,
                full_name: editingPatient.name,
                email: editingPatient.email,
                phone: editingPatient.phone,
                primary_address: editingPatient.address,
                dob: editingPatient.date_of_birth || "",
                county: editingPatient.county || "",
                waiver_type: editingPatient.waiver_type || "",
                referral_by: editingPatient.referral_by || "",
                referral_date: editingPatient.referral_date || "",
                referral_expiration_date:
                  editingPatient.referral_expiration_date || "",
                service_type: editingPatient.service_type || "",
                case_manager: editingPatient.case_manager || "",
                case_manager_phone: editingPatient.case_manager_phone || "",
                case_manager_email: editingPatient.case_manager_email || "",
                monthly_credit: editingPatient.monthly_credit?.toString() || "",
                credit_used_for: editingPatient.credit_used_for || "",
                vehicle_type_need: editingPatient.vehicle_type_need || "",
                notes: editingPatient.notes || "",
                custom_fields: editingPatient.custom_fields,
              }
            : undefined
        }
      />

      {/* Demo Mode Banner */}
      {isDemoMode && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
              <CloudArrowUp
                size={20}
                weight="duotone"
                className="text-amber-600"
              />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-900">
                Viewing demo client data
              </p>
              <p className="text-xs text-amber-700">
                Upload your own data or add clients to see real records
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateTo("upload")}
              className="border-amber-300 text-amber-700 hover:bg-amber-100"
            >
              Upload Data
            </Button>
          </div>
        </div>
      )}

      {/* Stats Row - Inline like reference  */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4 divide-x divide-slate-100">
          <div className="pl-0">
            <InlineStat label="Total Clients" value={patients.length} />
          </div>
          <div className="pl-8">
            <InlineStat
              label="Active"
              value={activeCount}
              valueColor="text-[#2E7D32]"
            />
          </div>
          <div className="pl-8">
            <InlineStat
              label="New This Month"
              value="23"
              valueColor="text-[#1976D2]"
            />
          </div>
          <div className="pl-8">
            <InlineStat
              label="Total Trips"
              value={totalTrips}
              valueColor="text-[#E65100]"
            />
          </div>
        </div>
      </div>

      {/* Search, Filters, and View Toggle */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <MagnifyingGlass
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            placeholder="Search clients by name, email, or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#3D5A3D]/20 focus:border-[#3D5A3D]"
          />
        </div>
        <Button
          variant="outline"
          className="inline-flex items-center gap-2 rounded-lg border-slate-200 bg-white hover:bg-slate-50"
        >
          <Funnel size={16} />
          Filters
        </Button>
        <Button
          variant="outline"
          onClick={handleExport}
          className="inline-flex items-center gap-2 rounded-lg border-slate-200 bg-white hover:bg-slate-50"
        >
          <DownloadSimple size={16} />
          Export
        </Button>

        {/* View Toggle */}
        <div className="flex rounded-lg border border-slate-200 bg-white p-1">
          <button
            onClick={() => setViewMode("bento")}
            className={cn(
              "flex items-center justify-center p-2 rounded-md transition-colors",
              viewMode === "bento"
                ? "bg-[#3D5A3D] text-white"
                : "text-slate-500 hover:text-slate-700 hover:bg-slate-100",
            )}
          >
            <GridFour
              size={18}
              weight={viewMode === "bento" ? "fill" : "regular"}
            />
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={cn(
              "flex items-center justify-center p-2 rounded-md transition-colors",
              viewMode === "list"
                ? "bg-[#3D5A3D] text-white"
                : "text-slate-500 hover:text-slate-700 hover:bg-slate-100",
            )}
          >
            <List size={18} weight={viewMode === "list" ? "fill" : "regular"} />
          </button>
        </div>
      </div>

      {/* Multi-select actions - Persistent to prevent layout shift */}
      <div
        className={cn(
          "flex items-center gap-3 p-3 rounded-xl border transition-all duration-200",
          selectedIds.size > 0
            ? "bg-indigo-50 border-indigo-200 shadow-sm"
            : "bg-slate-50 border-slate-200",
        )}
      >
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 ? (
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-100">
              <Check className="h-3 w-3 text-indigo-600" />
            </div>
          ) : (
            <div className="h-5 w-5" /> // Spacer
          )}
          <span
            className={cn(
              "text-sm font-medium transition-colors",
              selectedIds.size > 0 ? "text-indigo-900" : "text-slate-500",
            )}
          >
            {selectedIds.size} client{selectedIds.size !== 1 ? "s" : ""}{" "}
            selected
          </span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowBulkDeleteDialog(true)}
            disabled={selectedIds.size === 0 || isDemoMode}
            className={cn(
              "transition-all duration-200",
              selectedIds.size > 0
                ? "border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800 hover:border-red-300"
                : "border-transparent text-slate-300 cursor-not-allowed hover:bg-transparent",
            )}
          >
            <Trash className="mr-2 h-3.5 w-3.5" />
            Delete
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={selectNone}
            disabled={selectedIds.size === 0}
            className={cn(
              "transition-all duration-200",
              selectedIds.size > 0
                ? "border-indigo-200 text-indigo-700 hover:bg-indigo-100 hover:border-indigo-300"
                : "border-transparent text-slate-300 cursor-not-allowed hover:bg-transparent",
            )}
          >
            Clear Selection
          </Button>
        </div>
      </div>

      {/* Bento Cards View */}
      {viewMode === "bento" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {paginatedPatients.map((patient) => (
            <div
              key={patient.id}
              className={cn(
                "rounded-2xl border bg-white p-5 shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5",
                selectedIds.has(patient.id)
                  ? "border-[#3D5A3D] ring-2 ring-[#3D5A3D]/20"
                  : "border-slate-200",
              )}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-4">
                  {/* Checkbox for multi-select */}
                  <Checkbox
                    checked={selectedIds.has(patient.id)}
                    onCheckedChange={() => toggleSelect(patient.id)}
                    className="mt-1"
                  />
                  <div
                    className="w-14 h-14 rounded-full bg-[#3D5A3D] flex items-center justify-center text-white text-lg font-semibold cursor-pointer"
                    onClick={() =>
                      canManagePatients && onPatientClick?.(patient.id)
                    }
                  >
                    {(patient.name || "C")
                      .split(" ")
                      .filter(Boolean)
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase()}
                  </div>
                  <div
                    className={cn(canManagePatients && "cursor-pointer")}
                    onClick={() =>
                      canManagePatients && onPatientClick?.(patient.id)
                    }
                  >
                    <h3 className="text-base font-semibold text-slate-900">
                      {patient.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1 text-sm text-slate-500">
                      <CalendarBlank size={14} weight="duotone" />
                      <span>Age: {patient.age}</span>
                    </div>
                  </div>
                </div>
                <span
                  className={cn(
                    "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold",
                    patient.status === "active"
                      ? "bg-[#E8F5E9] text-[#2E7D32]"
                      : "bg-slate-100 text-slate-600",
                  )}
                >
                  {patient.status.charAt(0).toUpperCase() +
                    patient.status.slice(1)}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Phone
                      size={14}
                      weight="duotone"
                      className="text-slate-400"
                    />
                    {patient.phone || "—"}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Envelope
                      size={14}
                      weight="duotone"
                      className="text-slate-400"
                    />
                    <span className="truncate">{patient.email || "—"}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <MapPin
                      size={14}
                      weight="duotone"
                      className="text-slate-400 flex-shrink-0"
                    />
                    <span className="line-clamp-1">
                      {patient.address || "—"}
                    </span>
                  </div>
                  <div className="text-sm text-slate-600">
                    <span className="font-medium text-slate-500">Trips:</span>{" "}
                    {patient.totalTrips}
                  </div>
                </div>
              </div>

              {patient.service_type && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 border border-slate-100 mb-4">
                  <span className="text-xs text-slate-500">Service:</span>
                  <span className="text-sm text-slate-700 font-medium">
                    {patient.service_type}
                  </span>
                </div>
              )}

              {canManagePatients && (
                <div
                  className="flex gap-2 pt-4 border-t border-slate-100"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onPatientClick?.(patient.id)}
                    className="flex-1 rounded-lg border-slate-200 hover:bg-slate-50"
                  >
                    View Details
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isDemoMode}
                        className="rounded-lg border-slate-200 hover:bg-slate-50"
                      >
                        <DotsThreeVertical size={16} weight="bold" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                      <DropdownMenuItem
                        onClick={() => setEditingPatient(patient)}
                        className="gap-2"
                      >
                        <Pencil className="h-4 w-4" />
                        Edit Client
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteId(patient.id);
                        }}
                        className="gap-2 text-red-600 focus:text-red-600 focus:bg-red-50"
                      >
                        <Trash className="h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* List View */}
      {viewMode === "list" && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-4 text-left">
                    <Checkbox
                      checked={isAllSelected}
                      onCheckedChange={() => {
                        if (isAllSelected) {
                          selectNone();
                        } else {
                          selectAll();
                        }
                      }}
                    />
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Client Name
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Phone Number
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Address
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Last Visit
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Trips
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedPatients.map((patient) => (
                  <tr
                    key={patient.id}
                    onClick={() =>
                      canManagePatients && onPatientClick?.(patient.id)
                    }
                    className={cn(
                      "hover:bg-slate-50/50 transition-colors",
                      canManagePatients && "cursor-pointer",
                      selectedIds.has(patient.id) && "bg-indigo-50",
                    )}
                  >
                    <td
                      className="px-4 py-4"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Checkbox
                        checked={selectedIds.has(patient.id)}
                        onCheckedChange={() => toggleSelect(patient.id)}
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#3D5A3D] flex items-center justify-center text-white font-semibold text-sm">
                          {(patient?.name || "C")
                            .split(" ")
                            .filter(Boolean)
                            .map((n) => n?.[0] || "")
                            .join("")
                            .toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">
                            {patient.name}
                          </p>
                          <p className="text-sm text-slate-500">
                            Age: {patient.age}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <Phone
                          size={14}
                          weight="duotone"
                          className="text-slate-400 flex-shrink-0"
                        />
                        <span className="whitespace-nowrap">
                          {patient.phone || "—"}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <MapPin
                          size={14}
                          weight="duotone"
                          className="text-slate-400 flex-shrink-0"
                        />
                        <span className="line-clamp-1">
                          {patient.address || "—"}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <CalendarBlank
                          size={14}
                          weight="duotone"
                          className="text-slate-400"
                        />
                        {new Date(patient.lastVisit).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-semibold text-slate-900">
                        {patient.totalTrips}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={cn(
                          "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold",
                          patient.status === "active"
                            ? "bg-[#E8F5E9] text-[#2E7D32]"
                            : "bg-slate-100 text-slate-600",
                        )}
                      >
                        {patient.status.charAt(0).toUpperCase() +
                          patient.status.slice(1)}
                      </span>
                    </td>
                    <td
                      className="px-6 py-4 whitespace-nowrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {canManagePatients && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              disabled={isDemoMode}
                              className="p-2 rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-50"
                            >
                              <DotsThreeVertical
                                size={18}
                                weight="bold"
                                className="text-slate-500"
                              />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40">
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingPatient(patient);
                              }}
                              className="gap-2"
                            >
                              <Pencil className="h-4 w-4" />
                              Edit Client
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteId(patient.id);
                              }}
                              className="gap-2 text-red-600 focus:text-red-600 focus:bg-red-50"
                            >
                              <Trash className="h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          Showing{" "}
          <span className="font-semibold text-slate-900">
            {Math.min(
              (currentPage - 1) * ITEMS_PER_PAGE + 1,
              filteredPatients.length,
            )}
          </span>{" "}
          -{" "}
          <span className="font-semibold text-slate-900">
            {Math.min(currentPage * ITEMS_PER_PAGE, filteredPatients.length)}
          </span>{" "}
          of{" "}
          <span className="font-semibold text-slate-900">
            {filteredPatients.length}
          </span>{" "}
          clients
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            className="rounded-lg border-slate-200 gap-1"
          >
            <CaretLeft size={16} />
            Previous
          </Button>

          {/* Page numbers */}
          <div className="hidden sm:flex gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <Button
                key={page}
                variant={page === currentPage ? "default" : "outline"}
                size="sm"
                onClick={() => setCurrentPage(page)}
                className={cn(
                  "rounded-lg w-9",
                  page === currentPage
                    ? "bg-[#3D5A3D] hover:bg-[#2E4A2E]"
                    : "border-slate-200",
                )}
              >
                {page}
              </Button>
            ))}
          </div>

          <Button
            variant="outline"
            size="sm"
            disabled={currentPage === totalPages || totalPages === 0}
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            className="rounded-lg border-slate-200 gap-1"
          >
            Next
            <CaretRight size={16} />
          </Button>
        </div>
      </div>

      <DeleteConfirmationDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        onConfirm={handleDeletePatient}
        title="Delete Client?"
        description="This action cannot be undone. This will permanently delete the client"
        itemName={patients.find((p) => p.id === deleteId)?.name}
        isDeleting={isDeleting}
      />

      <DeleteConfirmationDialog
        open={showBulkDeleteDialog}
        onOpenChange={setShowBulkDeleteDialog}
        onConfirm={handleBulkDelete}
        title="Delete Selected Clients?"
        description="This action cannot be undone. This will permanently delete the selected clients"
        itemName={`${selectedIds.size} clients`}
        isDeleting={isDeleting}
      />
    </div>
  );
}
