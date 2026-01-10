import { useState, useMemo } from "react";
import {
  MagnifyingGlass,
  Plus,
  DotsThreeVertical,
  Phone,
  Envelope,
  Briefcase,
  Funnel,
  DownloadSimple,
  Calendar,
  MapPin,
  CloudArrowUp,
  GridFour,
  List,
  CaretLeft,
  CaretRight,
} from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { EmployeeForm } from "@/components/forms/employee-form";
import { Loader2, Pencil, Trash, Check } from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { EmployeesEmptyState } from "@/components/ui/empty-state";

import { exportToExcel } from "@/lib/export";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useQueryClient } from "@tanstack/react-query";
import { DeleteConfirmationDialog } from "@/components/ui/delete-confirmation-dialog";
import { EmployeeDetailsPage } from "@/components/employee-details-page";
import { Checkbox } from "@/components/ui/checkbox";

interface Employee {
  id: string;
  name: string;
  phone: string;
  email: string;
  department: string;
  position: string;
  hireDate: string;
  location: string;
  status: "active" | "on-leave" | "inactive";
  notes?: string | null;
  custom_fields?: Record<string, string> | null;
}

const ITEMS_PER_PAGE = 5;

// Demo data for preview mode

const demoEmployees: Employee[] = [
  {
    id: "1",
    name: "Sarah Johnson",
    phone: "(555) 101-2021",
    email: "sarah.johnson@meditrans.com",
    department: "Operations",
    position: "Operations Manager",
    hireDate: "2022-03-15",
    location: "Main Office",
    status: "active",
  },
  {
    id: "2",
    name: "Mark Thompson",
    phone: "(555) 202-3032",
    email: "mark.thompson@meditrans.com",
    department: "Dispatch",
    position: "Senior Dispatcher",
    hireDate: "2021-08-22",
    location: "Main Office",
    status: "active",
  },
  {
    id: "3",
    name: "Emily Rodriguez",
    phone: "(555) 303-4043",
    email: "emily.r@meditrans.com",
    department: "Customer Service",
    position: "Customer Service Rep",
    hireDate: "2023-01-10",
    location: "Downtown Branch",
    status: "active",
  },
  {
    id: "4",
    name: "James Wilson",
    phone: "(555) 404-5054",
    email: "james.wilson@meditrans.com",
    department: "Finance",
    position: "Accountant",
    hireDate: "2022-06-01",
    location: "Main Office",
    status: "on-leave",
  },
  {
    id: "5",
    name: "Lisa Chen",
    phone: "(555) 505-6065",
    email: "lisa.chen@meditrans.com",
    department: "IT",
    position: "IT Support Specialist",
    hireDate: "2023-04-18",
    location: "Main Office",
    status: "active",
  },
  {
    id: "6",
    name: "Robert Brown",
    phone: "(555) 606-7076",
    email: "robert.brown@meditrans.com",
    department: "HR",
    position: "HR Coordinator",
    hireDate: "2021-11-30",
    location: "Main Office",
    status: "inactive",
  },
];

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
      <div className="flex items-center gap-1">
        <span
          className={cn("text-2xl font-semibold tracking-tight", valueColor)}
        >
          {value}
        </span>
      </div>
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

export function EmployeesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(
    null
  );
  const { isDemoMode, navigateTo } = useOnboarding();
  const { currentOrganization } = useOrganization();
  const { isAdmin } = usePermissions();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const queryClient = useQueryClient();

  // View and pagination state
  const [viewMode, setViewMode] = useState<"bento" | "list">("bento");
  const [currentPage, setCurrentPage] = useState(1);

  // Multi-select state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0 || isDemoMode) return;
    setIsDeleting(true);

    try {
      const { error } = await supabase
        .from("employees")
        .delete()
        .in("id", Array.from(selectedIds));

      if (error) throw error;

      queryClient.invalidateQueries({
        queryKey: ["employees", currentOrganization?.id],
      });
      setSelectedIds(new Set());
      setShowBulkDeleteDialog(false);
    } catch (err) {
      console.error("Failed to delete employees:", err);
    } finally {
      setIsDeleting(false);
    }
  };

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

  const selectNone = () => {
    setSelectedIds(new Set());
  };

  const { data: realEmployees, isLoading } = useQuery({
    queryKey: ["employees", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization) return [];

      const { data, error } = await supabase
        .from("employees")
        .select("*")
        .eq("org_id", currentOrganization.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return data.map(
        (e) =>
          ({
            id: e.id,
            name: e.full_name,
            phone: e.phone || "",
            email: e.email || "",
            department: e.department || "Unassigned",
            position: e.role || "Staff",
            hireDate: e.hire_date || e.created_at,
            location: "Main Office", // Mock for now
            status: (e.status || "active").toLowerCase() as
              | "active"
              | "on-leave"
              | "inactive",
            notes: e.notes,
            custom_fields: e.custom_fields,
          } as Employee)
      );
    },
    enabled: !!currentOrganization,
  });

  const handleExport = () => {
    if (!employees.length) return;
    const exportData = employees.map((e) => ({
      Name: e.name,
      Email: e.email,
      Phone: e.phone,
      Department: e.department,
      Position: e.position,
      "Hire Date": e.hireDate,
      Status: e.status,
    }));
    exportToExcel(
      exportData,
      `employees_${new Date().toISOString().split("T")[0]}`
    );
  };

  const handleDeleteEmployee = async () => {
    if (!deleteId || isDemoMode) return;
    setIsDeleting(true);

    try {
      const { error } = await supabase
        .from("employees")
        .delete()
        .eq("id", deleteId);
      if (error) throw error;
      queryClient.invalidateQueries({
        queryKey: ["employees", currentOrganization?.id],
      });
      setDeleteId(null);
    } catch (err) {
      console.error("Failed to delete employee:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  const hasRealData = realEmployees && realEmployees.length > 0;
  const showData = hasRealData || isDemoMode;
  const employees = hasRealData
    ? realEmployees
    : isDemoMode
    ? demoEmployees
    : [];

  const filteredEmployees = employees.filter((employee) => {
    const nameMatch = (employee.name || "")
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const emailMatch = (employee.email || "")
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const deptMatch = (employee.department || "")
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const posMatch = (employee.position || "")
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const phoneMatch = (employee.phone || "").includes(searchQuery);
    return nameMatch || emailMatch || deptMatch || posMatch || phoneMatch;
  });

  // Pagination
  const totalPages = Math.ceil(filteredEmployees.length / ITEMS_PER_PAGE);
  const paginatedEmployees = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredEmployees.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredEmployees, currentPage]);

  // Reset to page 1 when search changes
  useMemo(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const selectAll = () => {
    setSelectedIds(new Set(paginatedEmployees.map((e) => e.id)));
  };

  const isAllSelected =
    paginatedEmployees.length > 0 &&
    paginatedEmployees.every((e) => selectedIds.has(e.id));

  const activeCount = employees.filter((e) => e.status === "active").length;
  const onLeaveCount = employees.filter((e) => e.status === "on-leave").length;
  const departments = [...new Set(employees.map((e) => e.department))].length;

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  if (selectedEmployeeId) {
    return (
      <EmployeeDetailsPage
        id={selectedEmployeeId}
        onBack={() => setSelectedEmployeeId(null)}
      />
    );
  }

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
        {/* Employee Form (Add/Edit) */}
        <EmployeeForm
          open={showAddForm || !!editingEmployee}
          onOpenChange={(open) => {
            if (!open) {
              setShowAddForm(false);
              setEditingEmployee(null);
            }
          }}
          initialData={
            editingEmployee
              ? {
                  id: editingEmployee.id,
                  full_name: editingEmployee.name,
                  email: editingEmployee.email,
                  phone: editingEmployee.phone,
                  role: editingEmployee.position,
                  department: editingEmployee.department,
                  hire_date: editingEmployee.hireDate,
                  notes: editingEmployee.notes || "",
                  custom_fields: editingEmployee.custom_fields,
                  system_role: "none",
                }
              : undefined
          }
        />

        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold text-slate-900">Employees</h1>
            <p className="text-sm text-slate-500">
              Manage staff members and departments
            </p>
          </div>
        </div>

        {/* Stats Row with zeros */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4 divide-x divide-slate-100">
            <div className="pl-0">
              <ZeroStat label="Total Employees" />
            </div>
            <div className="pl-8">
              <ZeroStat label="Active" />
            </div>
            <div className="pl-8">
              <ZeroStat label="On Leave" />
            </div>
            <div className="pl-8">
              <ZeroStat label="Departments" />
            </div>
          </div>
        </div>

        {/* Empty State */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <EmployeesEmptyState
            onAddEmployee={isAdmin ? () => setShowAddForm(true) : () => {}}
            onUpload={isAdmin ? () => navigateTo("upload") : () => {}}
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
            <h1 className="text-2xl font-semibold text-slate-900">Employees</h1>
            {isDemoMode && <DemoIndicator />}
          </div>
          <p className="text-sm text-slate-500">
            Manage staff members and departments
          </p>
        </div>
        {isAdmin && (
          <Button
            onClick={() => setShowAddForm(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-[#3D5A3D] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-[#2E4A2E]"
          >
            <Plus size={18} weight="bold" />
            Add Employee
          </Button>
        )}
      </div>

      {/* Employee Form (Add/Edit) */}
      <EmployeeForm
        open={showAddForm || !!editingEmployee}
        onOpenChange={(open) => {
          if (!open) {
            setShowAddForm(false);
            setEditingEmployee(null);
          }
        }}
        initialData={
          editingEmployee
            ? {
                id: editingEmployee.id,
                full_name: editingEmployee.name,
                email: editingEmployee.email,
                phone: editingEmployee.phone,
                role: editingEmployee.position,
                department: editingEmployee.department,
                hire_date: editingEmployee.hireDate,
                notes: editingEmployee.notes || "",
                custom_fields: editingEmployee.custom_fields,
                system_role: "none",
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
                Viewing demo employee data
              </p>
              <p className="text-xs text-amber-700">
                Upload your own data or add team members to see real records
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

      {/* Stats Row - Inline like reference */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4 divide-x divide-slate-100">
          <div className="pl-0">
            <InlineStat label="Total Employees" value={employees.length} />
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
              label="On Leave"
              value={onLeaveCount}
              valueColor="text-[#E65100]"
            />
          </div>
          <div className="pl-8">
            <InlineStat
              label="Departments"
              value={departments}
              valueColor="text-[#1976D2]"
            />
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <MagnifyingGlass
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            placeholder="Search employees by name, email, department or position..."
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
                : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
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
                : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
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
            : "bg-slate-50 border-slate-200"
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
              selectedIds.size > 0 ? "text-indigo-900" : "text-slate-500"
            )}
          >
            {selectedIds.size} employee{selectedIds.size !== 1 ? "s" : ""}{" "}
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
                : "border-transparent text-slate-300 cursor-not-allowed hover:bg-transparent"
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
                : "border-transparent text-slate-300 cursor-not-allowed hover:bg-transparent"
            )}
          >
            Clear Selection
          </Button>
        </div>
      </div>

      {/* Bento Cards View */}
      {viewMode === "bento" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {paginatedEmployees.map((employee) => (
            <div
              key={employee.id}
              onClick={() => setSelectedEmployeeId(employee.id)}
              className={cn(
                "rounded-2xl border bg-white p-5 shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 cursor-pointer",
                selectedIds.has(employee.id)
                  ? "border-indigo-500 ring-2 ring-indigo-500/20"
                  : "border-slate-200"
              )}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-4">
                  <Checkbox
                    checked={selectedIds.has(employee.id)}
                    onCheckedChange={() => toggleSelect(employee.id)}
                    className="mt-1"
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div className="w-14 h-14 aspect-square rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white text-lg font-semibold flex-shrink-0">
                    {(employee.name || "E")
                      .split(" ")
                      .filter(Boolean)
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">
                      {employee.name}
                    </h3>
                    <div className="flex items-center gap-1 mt-1">
                      <Briefcase
                        size={14}
                        weight="duotone"
                        className="text-slate-400"
                      />
                      <span className="text-sm text-slate-600">
                        {employee.position}
                      </span>
                    </div>
                  </div>
                </div>
                <span
                  className={cn(
                    "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold",
                    employee.status === "active"
                      ? "bg-[#E8F5E9] text-[#2E7D32]"
                      : employee.status === "on-leave"
                      ? "bg-[#FFF3E0] text-[#E65100]"
                      : "bg-slate-100 text-slate-600"
                  )}
                >
                  {employee.status === "on-leave"
                    ? "On Leave"
                    : employee.status.charAt(0).toUpperCase() +
                      employee.status.slice(1)}
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
                    {employee.phone}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Envelope
                      size={14}
                      weight="duotone"
                      className="text-slate-400"
                    />
                    <span className="truncate">{employee.email}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <MapPin
                      size={14}
                      weight="duotone"
                      className="text-slate-400"
                    />
                    {employee.location}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Calendar
                      size={14}
                      weight="duotone"
                      className="text-slate-400"
                    />
                    {formatDate(employee.hireDate)}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 border border-slate-100">
                <Briefcase
                  size={16}
                  weight="duotone"
                  className="text-[#1976D2]"
                />
                <span className="text-sm text-slate-600">
                  {employee.department}
                </span>
              </div>

              <div
                className="flex gap-2 mt-4 pt-4 border-t border-slate-100"
                onClick={(e) => e.stopPropagation()}
              >
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedEmployeeId(employee.id)}
                  className="flex-1 rounded-lg border-slate-200 hover:bg-slate-50"
                >
                  View Details
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isDemoMode || !isAdmin}
                      className="rounded-lg border-slate-200 hover:bg-slate-50"
                    >
                      <DotsThreeVertical size={16} weight="bold" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40">
                    <DropdownMenuItem
                      onClick={() => setEditingEmployee(employee)}
                      className="gap-2"
                    >
                      <Pencil className="h-4 w-4" />
                      Edit Employee
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteId(employee.id);
                      }}
                      className="gap-2 text-red-600 focus:text-red-600 focus:bg-red-50"
                    >
                      <Trash className="h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
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
                  <th className="px-4 py-4 text-left w-12">
                    <Checkbox
                      checked={isAllSelected}
                      onCheckedChange={() => {
                        if (isAllSelected) selectNone();
                        else selectAll();
                      }}
                    />
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Employee
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Department
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Position
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
                {paginatedEmployees.length > 0 ? (
                  paginatedEmployees.map((employee) => (
                    <tr
                      key={employee.id}
                      onClick={() => setSelectedEmployeeId(employee.id)}
                      className={cn(
                        "group transition-all duration-200 hover:bg-slate-50 cursor-pointer",
                        selectedIds.has(employee.id) &&
                          "bg-indigo-50/50 hover:bg-indigo-50"
                      )}
                    >
                      <td
                        className="px-4 py-4"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Checkbox
                          checked={selectedIds.has(employee.id)}
                          onCheckedChange={() => toggleSelect(employee.id)}
                        />
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 aspect-square rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
                            {(employee.name || "E")
                              .split(" ")
                              .filter(Boolean)
                              .map((n) => n[0])
                              .join("")
                              .toUpperCase()}
                          </div>
                          <div>
                            <div className="font-medium text-slate-900">
                              {employee.name}
                            </div>
                            <div className="text-sm text-slate-500">
                              Joined {formatDate(employee.hireDate)}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-sm text-slate-600">
                            <Phone size={14} className="text-slate-400" />
                            {employee.phone}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-slate-600">
                            <Envelope size={14} className="text-slate-400" />
                            <span className="truncate max-w-[150px]">
                              {employee.email}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                          <Briefcase size={14} className="text-slate-400" />
                          {employee.department}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-slate-600">
                          {employee.position}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={cn(
                            "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold",
                            employee.status === "active"
                              ? "bg-[#E8F5E9] text-[#2E7D32]"
                              : employee.status === "on-leave"
                              ? "bg-[#FFF3E0] text-[#E65100]"
                              : "bg-slate-100 text-slate-600"
                          )}
                        >
                          {employee.status === "on-leave"
                            ? "On Leave"
                            : employee.status.charAt(0).toUpperCase() +
                              employee.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div
                          className="flex items-center justify-end"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={isDemoMode || !isAdmin}
                                className="h-8 w-8 p-0 rounded-full hover:bg-slate-100"
                              >
                                <DotsThreeVertical size={16} />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => setEditingEmployee(employee)}
                                className="gap-2"
                              >
                                <Pencil className="h-4 w-4" />
                                Edit Employee
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteId(employee.id);
                                }}
                                className="gap-2 text-red-600 focus:text-red-600 focus:bg-red-50"
                              >
                                <Trash className="h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-6 py-12 text-center text-slate-500"
                    >
                      No employees found matching your search.
                    </td>
                  </tr>
                )}
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
              filteredEmployees.length
            )}
          </span>{" "}
          -{" "}
          <span className="font-semibold text-slate-900">
            {Math.min(currentPage * ITEMS_PER_PAGE, filteredEmployees.length)}
          </span>{" "}
          of{" "}
          <span className="font-semibold text-slate-900">
            {filteredEmployees.length}
          </span>{" "}
          employees
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
                    : "border-slate-200"
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
        onConfirm={handleDeleteEmployee}
        title="Delete Employee?"
        description="This action cannot be undone. This will permanently delete the employee"
        itemName={employees.find((e) => e.id === deleteId)?.name}
        isDeleting={isDeleting}
      />

      <DeleteConfirmationDialog
        open={showBulkDeleteDialog}
        onOpenChange={setShowBulkDeleteDialog}
        onConfirm={handleBulkDelete}
        title="Delete Selected Employees?"
        description="This action cannot be undone. This will permanently delete the selected employees"
        itemName={`${selectedIds.size} employees`}
        isDeleting={isDeleting}
      />
    </div>
  );
}
