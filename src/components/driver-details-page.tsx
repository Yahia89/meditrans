import { useState } from "react";
import {
  ArrowLeft,
  Phone,
  Mail,
  Loader2,
  Pencil,
  ShieldAlert,
  Car,
  ScanEye,
  TrendingUp,
  FileText,
  Trash,
  MapPin,
  Send,
  CheckCircle,
  Clock,
  RefreshCw,
} from "lucide-react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/hooks/usePermissions";
import { DriverForm } from "@/components/forms/driver-form";
import { DocumentManager } from "@/components/document-manager";
import { TripList } from "@/components/trips/TripList";
import { DeleteConfirmationDialog } from "@/components/ui/delete-confirmation-dialog";
import { useOnboarding } from "@/contexts/OnboardingContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useTimezone } from "@/hooks/useTimezone";
import { formatInUserTimezone } from "@/lib/timezone";

interface DriverDetailsPageProps {
  id: string;
  onBack: () => void;
  onTripClick?: (id: string) => void;
}

interface Driver {
  id: string;
  org_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  county: string | null;
  id_number: string | null;
  license_number: string | null;
  vehicle_info: string | null;
  vehicle_type: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_color: string | null;
  license_plate: string | null;
  dot_medical_number: string | null;
  dot_medical_expiration: string | null;
  insurance_company: string | null;
  insurance_policy_number: string | null;
  insurance_start_date: string | null;
  insurance_expiration_date: string | null;
  inspection_date: string | null;
  driver_record_issue_date: string | null;
  driver_record_expiration: string | null;
  notes: string | null;
  status: string;
  created_at: string;
  custom_fields: Record<string, any> | null;
  user_id: string | null;
}

function formatDate(dateStr: string | null, timezone: string) {
  if (!dateStr) return "Not specified";
  return formatInUserTimezone(dateStr, timezone, "MMMM d, yyyy");
}

function formatVehicleType(type: string | null) {
  if (!type) return "Standard";
  return type
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function getStatusConfig(status: string | null) {
  const s = (status || "").toUpperCase();
  if (s === "AVAILABLE")
    return { label: "Available", className: "bg-emerald-100 text-emerald-700" };
  if (s === "ON_TRIP" || s === "ON-TRIP")
    return { label: "On Trip", className: "bg-blue-100 text-blue-700" };
  return { label: s || "Offline", className: "bg-slate-100 text-slate-700" };
}

export function DriverDetailsPage({
  id,
  onBack,
  onTripClick,
}: DriverDetailsPageProps) {
  const [activeTab, setActiveTab] = useState<
    "overview" | "documents" | "trips"
  >("overview");
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { canEditDrivers } = usePermissions();
  const { isDemoMode } = useOnboarding();
  const { currentOrganization } = useOrganization();
  const activeTimezone = useTimezone();
  const queryClient = useQueryClient();

  const canManageDrivers = canEditDrivers;

  // Fetch driver data
  const { data: driver, isLoading: isLoadingDriver } = useQuery({
    queryKey: ["driver", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("drivers")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      return data as Driver;
    },
    enabled: !!id,
  });

  // Fetch trip count
  const { data: tripCount = 0 } = useQuery({
    queryKey: ["driver-trips-count", id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("trips")
        .select("*", { count: "exact", head: true })
        .eq("driver_id", id);
      if (error) throw error;
      return count || 0;
    },
  });

  // Fetch document count
  const { data: docCount = 0 } = useQuery({
    queryKey: ["driver-docs-count", id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("org_uploads")
        .select("*", { count: "exact", head: true })
        .eq("purpose", "driver_document")
        .eq("notes", id);
      if (error) throw error;
      return count || 0;
    },
  });

  // Fetch existing invitation for this driver's email
  const { data: inviteStatus, refetch: refetchInvite } = useQuery({
    queryKey: ["driver-invite", driver?.email, driver?.org_id],
    queryFn: async () => {
      if (!driver?.email || !driver?.org_id) return null;

      const { data, error } = await supabase
        .from("org_invites")
        .select("*")
        .eq("org_id", driver.org_id)
        .eq("email", driver.email)
        .eq("role", "driver")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!driver?.email && !!driver?.org_id,
  });

  // Send/resend invite mutation
  const sendInviteMutation = useMutation({
    mutationFn: async () => {
      if (!driver?.email || !currentOrganization) {
        throw new Error("Driver email and organization required");
      }

      // If there's an existing pending invite, delete it first
      if (inviteStatus && !inviteStatus.accepted_at) {
        await supabase.from("org_invites").delete().eq("id", inviteStatus.id);
      }

      // Create new invitation with driver's name
      const { error } = await supabase.from("org_invites").insert({
        org_id: currentOrganization.id,
        email: driver.email,
        role: "driver" as any,
        full_name: driver.full_name, // Store driver's name for accept-invite page
        invited_by: (await supabase.auth.getUser()).data.user?.id,
      });

      if (error) {
        if (error.code === "23505") {
          throw new Error(
            "An active invitation for this email already exists.",
          );
        }
        throw error;
      }
    },
    onSuccess: () => {
      refetchInvite();
      queryClient.invalidateQueries({ queryKey: ["driver-invite"] });
    },
  });

  // Determine invite button state
  const getInviteButtonConfig = () => {
    // 1. Check if driver already has a user account linked
    if (driver?.user_id) {
      return {
        label: "Account Active",
        disabled: true,
        icon: ShieldAlert,
        tooltip: "Driver already has an active system account",
      };
    }

    if (!driver?.email) {
      return {
        label: "No Email",
        disabled: true,
        icon: Mail,
        tooltip: "Add an email address to send an invitation",
      };
    }

    if (inviteStatus?.accepted_at) {
      return {
        label: "Invite Accepted",
        disabled: true,
        icon: CheckCircle,
        tooltip: "Driver has already accepted their invitation",
      };
    }

    if (inviteStatus && new Date(inviteStatus.expires_at) > new Date()) {
      return {
        label: "Resend Invite",
        disabled: false,
        icon: RefreshCw,
        tooltip: "Send a new invitation (previous invite will be replaced)",
      };
    }

    if (inviteStatus && new Date(inviteStatus.expires_at) <= new Date()) {
      return {
        label: "Invite Expired - Resend",
        disabled: false,
        icon: Clock,
        tooltip: "Previous invite has expired, send a new one",
      };
    }

    return {
      label: "Send Invite",
      disabled: false,
      icon: Send,
      tooltip: "Send a system invitation to the driver",
    };
  };

  const inviteButtonConfig = getInviteButtonConfig();

  const handleDelete = async () => {
    if (isDemoMode) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase.from("drivers").delete().eq("id", id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["drivers"] });
      onBack();
    } catch (err) {
      console.error("Failed to delete driver:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoadingDriver) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!driver) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">Driver not found</p>
        <Button variant="link" onClick={onBack}>
          Go back to drivers
        </Button>
      </div>
    );
  }

  const statusInfo = getStatusConfig(driver.status);

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
                {driver.full_name}
              </h1>
              <span
                className={cn(
                  "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
                  statusInfo.className,
                )}
              >
                {statusInfo.label}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-slate-500">
                ID: {driver.id.substring(0, 8)}
              </span>
            </div>
          </div>
        </div>

        {canManageDrivers && (
          <div className="flex gap-2 flex-wrap">
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
              onClick={() => sendInviteMutation.mutate()}
              disabled={
                inviteButtonConfig.disabled ||
                isDemoMode ||
                sendInviteMutation.isPending
              }
              title={inviteButtonConfig.tooltip}
              className={cn(
                "inline-flex items-center gap-2 rounded-xl",
                inviteButtonConfig.disabled
                  ? "text-slate-400"
                  : inviteStatus?.accepted_at
                    ? "text-green-600 border-green-100"
                    : "text-blue-600 border-blue-100 hover:bg-blue-50 hover:text-blue-700",
              )}
            >
              {sendInviteMutation.isPending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <inviteButtonConfig.icon size={16} />
              )}
              {sendInviteMutation.isPending
                ? "Sending..."
                : inviteButtonConfig.label}
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(true)}
              disabled={isDemoMode}
              className="inline-flex items-center gap-2 rounded-xl text-red-600 border-red-100 hover:bg-red-50 hover:text-red-700"
            >
              <Trash size={16} />
              Delete Driver
            </Button>
          </div>
        )}
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab("overview")}
          className={cn(
            "px-6 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2",
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
            "px-6 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2",
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
            "px-6 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2",
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
            {tripCount}
          </span>
        </button>
      </div>

      {/* Tab Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content Area */}
        <div className="lg:col-span-2 space-y-6">
          {activeTab === "overview" && (
            <div className="space-y-6">
              {/* Personal Information */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-900 mb-6">
                  Personal Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
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
                          {driver.phone || "Not specified"}
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
                          {driver.email || "Not specified"}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-slate-50 rounded-lg">
                        <MapPin className="w-5 h-5 text-slate-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">
                          Address
                        </p>
                        <p className="text-slate-900 mt-0.5">
                          {driver.address || "Not specified"}
                        </p>
                        {driver.county && (
                          <p className="text-xs text-slate-500 mt-0.5">
                            {driver.county} County
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-slate-50 rounded-lg">
                        <ScanEye className="w-5 h-5 text-slate-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">
                          License Number
                        </p>
                        <p className="text-slate-900 mt-0.5">
                          {driver.id_number ||
                            driver.license_number ||
                            "Not specified"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Fleet Information */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-900 mb-6">
                  Fleet Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-slate-50 rounded-lg">
                        <Car className="w-5 h-5 text-slate-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">
                          Vehicle
                        </p>
                        <p className="text-slate-900 mt-0.5 font-medium">
                          {driver.vehicle_make} {driver.vehicle_model}
                        </p>
                        <p className="text-xs text-slate-500">
                          {driver.vehicle_color || "No color"} •{" "}
                          {formatVehicleType(driver.vehicle_type) ||
                            driver.vehicle_info ||
                            "Standard"}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">
                        License Plate
                      </p>
                      <div className="mt-1 inline-block px-3 py-1 bg-slate-100 rounded border border-slate-200 font-mono text-sm font-bold text-slate-700">
                        {driver.license_plate || "NO PLATE"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Compliance & Insurance */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-900 mb-6">
                  Compliance & Insurance
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">
                        DOT Medical Info
                      </p>
                      <p className="text-slate-900 mt-1">
                        <span className="font-semibold">
                          {driver.dot_medical_number || "N/A"}
                        </span>
                        {driver.dot_medical_expiration && (
                          <span className="block text-xs text-slate-500 mt-0.5">
                            Expires:{" "}
                            {formatDate(
                              driver.dot_medical_expiration,
                              activeTimezone,
                            )}
                          </span>
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">
                        Insurance
                      </p>
                      <p className="text-slate-900 mt-1">
                        {driver.insurance_company || "Unknown Provider"}
                      </p>
                      <p className="text-xs text-slate-500">
                        Policy: {driver.insurance_policy_number || "N/A"}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">
                        Insurance Period
                      </p>
                      <div className="flex items-center gap-2 mt-1 text-sm text-slate-900">
                        <span>
                          {driver.insurance_start_date
                            ? formatDate(
                                driver.insurance_start_date,
                                activeTimezone,
                              )
                            : "Start"}
                        </span>
                        <span className="text-slate-400">→</span>
                        <span
                          className={cn(
                            driver.insurance_expiration_date &&
                              new Date(driver.insurance_expiration_date) <
                                new Date()
                              ? "text-red-600 font-bold"
                              : "",
                          )}
                        >
                          {driver.insurance_expiration_date
                            ? formatDate(
                                driver.insurance_expiration_date,
                                activeTimezone,
                              )
                            : "End"}
                        </span>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">
                        Last Inspection
                      </p>
                      <p className="text-slate-900 mt-1">
                        {formatDate(driver.inspection_date, activeTimezone)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-slate-900">
                    Notes
                  </h3>
                  <FileText className="w-5 h-5 text-slate-300" />
                </div>
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 min-h-[80px]">
                  {driver.notes ? (
                    <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">
                      {driver.notes}
                    </p>
                  ) : (
                    <p className="text-slate-400 italic">
                      No notes recorded for this driver.
                    </p>
                  )}
                </div>
              </div>

              {/* Custom Fields Display */}
              {driver.custom_fields &&
                Object.keys(driver.custom_fields).length > 0 && (
                  <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-lg font-semibold text-slate-900">
                        Additional Information
                      </h3>
                      <FileText className="w-5 h-5 text-slate-300" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {Object.entries(driver.custom_fields).map(
                        ([key, value]) => (
                          <div key={key} className="flex flex-col gap-1">
                            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                              {key}
                            </span>
                            <span className="text-slate-900">
                              {value as string}
                            </span>
                          </div>
                        ),
                      )}
                    </div>
                  </div>
                )}

              {/* Performance */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">
                    Total Trips
                  </h3>
                  <TrendingUp className="w-5 h-5 text-[#3D5A3D]" />
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-slate-900">
                    {tripCount}
                  </span>
                  <span className="text-slate-500 text-sm">Transports</span>
                </div>
                <p className="mt-2 text-xs text-slate-400 italic">
                  {tripCount > 0
                    ? `${tripCount} trips successfully managed.`
                    : "No trip history recorded yet."}
                </p>
              </div>
            </div>
          )}

          {activeTab === "documents" && (
            <DocumentManager
              ownerId={id}
              purpose="driver_document"
              source="drivers"
            />
          )}

          {activeTab === "trips" && (
            <TripList
              driverId={id}
              onTripClick={(tripId: string) => onTripClick?.(tripId)}
              hideHeader
            />
          )}
        </div>

        {/* Sidebar Stats/Summary */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-4">
              Driver Profile
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between py-2 border-b border-slate-50">
                <span className="text-sm text-slate-500">Account Type</span>
                <span className="text-sm font-semibold text-slate-900">
                  Standard Driver
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-50">
                <span className="text-sm text-slate-500">Last Active</span>
                <span className="text-sm text-slate-900">Never</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-50">
                <span className="text-sm text-slate-500">Status</span>
                <span
                  className={cn(
                    "text-sm font-semibold",
                    driver.status.toLowerCase() === "available"
                      ? "text-emerald-600"
                      : "text-slate-600",
                  )}
                >
                  {driver.status.toUpperCase()}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-50">
                <span className="text-sm text-slate-500">Member Since</span>
                <span className="text-sm text-slate-900">
                  {formatDate(driver.created_at, activeTimezone)}
                </span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-slate-500">System Access</span>
                <span
                  className={cn(
                    "text-sm font-semibold inline-flex items-center gap-1.5",
                    driver.user_id || inviteStatus?.accepted_at
                      ? "text-emerald-600"
                      : inviteStatus &&
                          new Date(inviteStatus.expires_at) > new Date()
                        ? "text-amber-600"
                        : inviteStatus &&
                            new Date(inviteStatus.expires_at) <= new Date()
                          ? "text-red-500"
                          : "text-slate-400",
                  )}
                >
                  {driver.user_id || inviteStatus?.accepted_at ? (
                    <>
                      <CheckCircle size={14} />
                      Active
                    </>
                  ) : inviteStatus &&
                    new Date(inviteStatus.expires_at) > new Date() ? (
                    <>
                      <Clock size={14} />
                      Pending
                    </>
                  ) : inviteStatus &&
                    new Date(inviteStatus.expires_at) <= new Date() ? (
                    <>
                      <Clock size={14} />
                      Expired
                    </>
                  ) : (
                    "Not Invited"
                  )}
                </span>
              </div>
            </div>
          </div>

          {!canManageDrivers && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
              <div className="flex items-center gap-3 text-amber-800 mb-2">
                <ShieldAlert size={20} />
                <span className="font-semibold">View Only</span>
              </div>
              <p className="text-sm text-amber-700 leading-relaxed">
                You have view-only access to this driver's profile. Only
                administrators and owners can modify details or manage
                documentation.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Edit Form */}
      <DriverForm
        open={isEditing}
        onOpenChange={setIsEditing}
        initialData={{
          id: driver.id,
          full_name: driver.full_name,
          id_number: driver.id_number || "",
          email: driver.email || "",
          phone: driver.phone || "",
          license_number: driver.license_number || "",
          address: driver.address || "",
          county: driver.county || "",
          vehicle_info: driver.vehicle_info || "",
          vehicle_type: driver.vehicle_type || "",
          vehicle_make: driver.vehicle_make || "",
          vehicle_model: driver.vehicle_model || "",
          vehicle_color: driver.vehicle_color || "",
          license_plate: driver.license_plate || "",
          dot_medical_number: driver.dot_medical_number || "",
          dot_medical_expiration: driver.dot_medical_expiration || "",
          insurance_company: driver.insurance_company || "",
          insurance_policy_number: driver.insurance_policy_number || "",
          insurance_start_date: driver.insurance_start_date || "",
          insurance_expiration_date: driver.insurance_expiration_date || "",
          inspection_date: driver.inspection_date || "",
          driver_record_issue_date: driver.driver_record_issue_date || "",
          driver_record_expiration: driver.driver_record_expiration || "",
          notes: driver.notes || "",
          custom_fields: driver.custom_fields,
        }}
      />

      <DeleteConfirmationDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        onConfirm={handleDelete}
        title="Delete Driver?"
        description="This action cannot be undone. This will permanently delete the driver and all associated data"
        itemName={driver.full_name}
        isDeleting={isDeleting}
      />
    </div>
  );
}
