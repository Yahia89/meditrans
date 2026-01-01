import { useState } from "react";
import {
  ArrowLeft,
  Phone,
  Mail,
  Loader2,
  Pencil,
  ShieldAlert,
  Briefcase,
  Calendar,
  MapPin,
  ChartPie,
  CheckCircle2,
  History,
  Trash,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/hooks/usePermissions";
import { EmployeeForm } from "@/components/forms/employee-form";
import { DocumentManager } from "@/components/document-manager";
import { DeleteConfirmationDialog } from "@/components/ui/delete-confirmation-dialog";
import { useOnboarding } from "@/contexts/OnboardingContext";

interface EmployeeDetailsPageProps {
  id: string;
  onBack: () => void;
}

interface Employee {
  id: string;
  org_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  department: string | null;
  role: string | null;
  status: string;
  hire_date: string | null;
  notes: string | null;
  created_at: string;
  custom_fields: Record<string, any> | null;
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "Not specified";
  return new Date(dateStr).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function EmployeeDetailsPage({ id, onBack }: EmployeeDetailsPageProps) {
  const [activeTab, setActiveTab] = useState<
    "overview" | "documents" | "trips"
  >("overview");
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { isAdmin, isOwner } = usePermissions();
  const { isDemoMode } = useOnboarding();
  const queryClient = useQueryClient();

  const canManageEmployees = isAdmin || isOwner;

  // Fetch employee data
  const { data: employee, isLoading: isLoadingEmployee } = useQuery({
    queryKey: ["employee", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      return data as Employee;
    },
    enabled: !!id,
  });
  // Fetch document count
  const { data: docCount = 0 } = useQuery({
    queryKey: ["employee-docs-count", id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("org_uploads")
        .select("*", { count: "exact", head: true })
        .eq("purpose", "employee_document")
        .eq("notes", id);
      if (error) throw error;
      return count || 0;
    },
  });

  const handleDelete = async () => {
    if (isDemoMode) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase.from("employees").delete().eq("id", id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      onBack();
    } catch (err) {
      console.error("Failed to delete employee:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoadingEmployee) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">Employee not found</p>
        <Button variant="link" onClick={onBack}>
          Go back to employees
        </Button>
      </div>
    );
  }

  const workEvents = [
    {
      date: employee.hire_date,
      title: "Employment Started",
      description: `Joined as ${employee.role || "Staff Member"} in ${
        employee.department || "the organization"
      }.`,
      icon: CheckCircle2,
      color: "text-emerald-500",
      bg: "bg-emerald-50",
    },
    {
      date: employee.created_at,
      title: "Account Created",
      description: "Profile was initialized in the system.",
      icon: Calendar,
      color: "text-blue-500",
      bg: "bg-blue-50",
    },
  ]
    .filter((e) => e.date)
    .sort((a, b) => new Date(b.date!).getTime() - new Date(a.date!).getTime());

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
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold text-slate-900">
                {employee.full_name}
              </h1>
              <span
                className={cn(
                  "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
                  employee.status === "ACTIVE" || employee.status === "active"
                    ? "bg-emerald-100 text-emerald-700"
                    : employee.status === "ON_LEAVE" ||
                      employee.status === "on-leave"
                    ? "bg-amber-100 text-amber-700"
                    : "bg-slate-100 text-slate-700"
                )}
              >
                {employee.status.replace("_", " ")}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-slate-500">
                Member ID: {employee.id.substring(0, 8)}
              </span>
            </div>
          </div>
        </div>

        {canManageEmployees && (
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
              Delete Employee
            </Button>
          </div>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab("overview")}
          className={cn(
            "px-6 py-3 text-sm font-medium border-b-2 transition-colors",
            activeTab === "overview"
              ? "border-[#3D5A3D] text-[#3D5A3D]"
              : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
          )}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab("documents")}
          className={cn(
            "px-6 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2",
            activeTab === "documents"
              ? "border-[#3D5A3D] text-[#3D5A3D]"
              : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
          )}
        >
          Documents
          <span
            className={cn(
              "px-2 py-0.5 rounded-full text-[10px] font-bold",
              activeTab === "documents"
                ? "bg-[#3D5A3D] text-white"
                : "bg-slate-100 text-slate-500"
            )}
          >
            {docCount}
          </span>
        </button>
        <button
          onClick={() => setActiveTab("trips")}
          className={cn(
            "px-6 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2",
            activeTab === "trips"
              ? "border-[#3D5A3D] text-[#3D5A3D]"
              : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
          )}
        >
          Work History
        </button>
      </div>

      {/* Tab Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content Area */}
        <div className="lg:col-span-2 space-y-6">
          {activeTab === "overview" && (
            <div className="space-y-6">
              {/* Professional Information */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-900 mb-6">
                  Staff Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-slate-50 rounded-lg">
                        <Briefcase className="w-5 h-5 text-slate-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">
                          Role / Position
                        </p>
                        <p className="text-slate-900 mt-0.5">
                          {employee.role || "Not specified"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-slate-50 rounded-lg">
                        <ChartPie className="w-5 h-5 text-slate-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">
                          Department
                        </p>
                        <p className="text-slate-900 mt-0.5">
                          {employee.department || "Unassigned"}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-slate-50 rounded-lg">
                        <Phone className="w-5 h-5 text-slate-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">
                          Contact Phone
                        </p>
                        <p className="text-slate-900 mt-0.5">
                          {employee.phone || "Not specified"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-slate-50 rounded-lg">
                        <Mail className="w-5 h-5 text-slate-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">
                          Email Address
                        </p>
                        <p className="text-slate-900 mt-0.5">
                          {employee.email || "Not specified"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Additional Information */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-900 mb-6">
                  Employment Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-slate-50 rounded-lg">
                      <Calendar className="w-5 h-5 text-slate-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">
                        Hire Date
                      </p>
                      <p className="text-slate-900 mt-0.5">
                        {formatDate(employee.hire_date)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-slate-50 rounded-lg">
                      <MapPin className="w-5 h-5 text-slate-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">
                        Primary Location
                      </p>
                      <p className="text-slate-900 mt-0.5">Main Office</p>
                    </div>
                  </div>
                </div>

                {employee.notes && (
                  <div className="mt-8 pt-6 border-t border-slate-100">
                    <p className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-2">
                      Internal Notes
                    </p>
                    <p className="text-slate-600 text-sm whitespace-pre-wrap">
                      {employee.notes}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "documents" && (
            <DocumentManager
              ownerId={id}
              purpose="employee_document"
              source="employees"
            />
          )}

          {activeTab === "trips" && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
              <div className="flex items-center gap-3 mb-8">
                <div className="p-2 bg-[#3D5A3D]/10 rounded-lg">
                  <History className="w-5 h-5 text-[#3D5A3D]" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900">
                  Career Timeline
                </h3>
              </div>

              <div className="relative space-y-8 before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-slate-200 before:via-slate-200 before:to-transparent">
                {workEvents.length > 0 ? (
                  workEvents.map((event, idx) => (
                    <div
                      key={idx}
                      className="relative flex items-start gap-6 pl-2"
                    >
                      <div
                        className={cn(
                          "relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-4 border-white shadow-sm z-10",
                          event.bg
                        )}
                      >
                        <event.icon className={cn("w-5 h-5", event.color)} />
                      </div>
                      <div className="flex-1 pt-1">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mb-1">
                          <h4 className="text-sm font-bold text-slate-900">
                            {event.title}
                          </h4>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">
                            {formatDate(event.date)}
                          </span>
                        </div>
                        <p className="text-sm text-slate-500 leading-relaxed">
                          {event.description}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12">
                    <p className="text-slate-500 italic">
                      No history records available.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar Stats/Summary */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4">
              Account Status
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between py-2 border-b border-slate-50">
                <span className="text-sm text-slate-500">
                  Organization Access
                </span>
                <span className="text-sm font-semibold text-slate-900">
                  Standard User
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-50">
                <span className="text-sm text-slate-500">Last Activity</span>
                <span className="text-sm text-slate-900">Never</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-slate-500">Added On</span>
                <span className="text-sm text-slate-900">
                  {formatDate(employee.created_at)}
                </span>
              </div>
            </div>
          </div>

          {!canManageEmployees && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
              <div className="flex items-center gap-3 text-amber-800 mb-2">
                <ShieldAlert size={20} />
                <span className="font-semibold">View Only</span>
              </div>
              <p className="text-sm text-amber-700 leading-relaxed">
                You have view-only access to this profile. Only administrators
                and owners can modify details or manage documentation.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Edit Form */}
      <EmployeeForm
        open={isEditing}
        onOpenChange={setIsEditing}
        initialData={{
          id: employee.id,
          full_name: employee.full_name,
          email: employee.email || "",
          phone: employee.phone || "",
          role: employee.role || "",
          department: employee.department || "",
          hire_date: employee.hire_date || "",
          notes: employee.notes || "",
          custom_fields: employee.custom_fields,
          system_role: "none",
        }}
      />

      <DeleteConfirmationDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        onConfirm={handleDelete}
        title="Delete Employee?"
        description="This action cannot be undone. This will permanently delete the employee record"
        itemName={employee.full_name}
        isDeleting={isDeleting}
      />
    </div>
  );
}
