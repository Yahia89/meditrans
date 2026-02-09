import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import {
  Buildings,
  User,
  Phone,
  Globe,
  PencilSimple,
  Trash,
  ArrowClockwise,
  Plus,
  CheckCircle,
  Clock,
  MapPin,
  EnvelopeSimple,
  CircleNotch,
  WarningCircle,
  Calendar,
} from "@phosphor-icons/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TimezoneSelector } from "../timezone-selector";
import { getTimezoneLabel } from "@/lib/timezone";
import { StateSelector } from "../state-selector";

const formatPhoneNumber = (value: string) => {
  if (!value) return value;
  const phoneNumber = value.replace(/[^\d]/g, "");
  const phoneNumberLength = phoneNumber.length;
  if (phoneNumberLength < 4) return phoneNumber;
  if (phoneNumberLength < 7) {
    return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3)}`;
  }
  return `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(
    3,
    6,
  )}-${phoneNumber.slice(6, 10)}`;
};

interface Organization {
  id: string;
  name: string;
  slug: string;
  billing_email: string | null;
  timezone: string;
  contact_name: string | null;
  contact_phone: string | null;
  operating_state: string | null;
  created_at: string;
  onboarding_status: "pending" | "accepted";
  accepted_at: string | null;
  org_invites?: {
    id: string;
    accepted_at: string | null;
    email: string;
    role: string;
  }[];
}

export function CompaniesPage({
  onCreateClick,
}: {
  onCreateClick?: () => void;
}) {
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit state
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
  const [editForm, setEditForm] = useState<Partial<Organization>>({});
  const [isUpdating, setIsUpdating] = useState(false);

  const fetchOrgs = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from("organizations")
        .select(
          `
          *,
          org_invites(id, accepted_at, email, role)
        `,
        )
        .order("created_at", { ascending: false });

      if (error) throw error;
      setOrgs(data || []);
    } catch (err: any) {
      console.error("Error fetching organizations:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrgs();
  }, []);

  const handleEditClick = (org: Organization) => {
    setEditingOrg(org);
    setEditForm({
      name: org.name,
      billing_email: org.billing_email,
      timezone: org.timezone,
      contact_name: org.contact_name,
      contact_phone: org.contact_phone,
      operating_state: org.operating_state,
      onboarding_status: org.onboarding_status,
      accepted_at: org.accepted_at,
    });
  };

  const handleUpdate = async () => {
    if (!editingOrg) return;
    setIsUpdating(true);
    try {
      // 1. Update Organization
      const { error: orgError } = await supabase
        .from("organizations")
        .update({
          name: editForm.name,
          billing_email: editForm.billing_email,
          timezone: editForm.timezone,
          contact_name: editForm.contact_name,
          contact_phone: editForm.contact_phone?.replace(/\D/g, ""),
          operating_state: editForm.operating_state,
          onboarding_status: editForm.onboarding_status,
          accepted_at: editForm.accepted_at,
        })
        .eq("id", editingOrg.id);

      if (orgError) throw orgError;

      setEditingOrg(null);
      fetchOrgs();
    } catch (err: any) {
      alert("Error updating organization: " + err.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (
      !confirm(
        `Are you sure you want to delete organization "${name}"? This action cannot be undone and will delete all associated data (drivers, patients, trips).`,
      )
    )
      return;

    try {
      const { error } = await supabase
        .from("organizations")
        .delete()
        .eq("id", id);
      if (error) throw error;
      // Refresh list
      fetchOrgs();
    } catch (err: any) {
      alert("Error deleting organization: " + err.message);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <CircleNotch className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 rounded-xl bg-red-50 text-red-600 border border-red-100 flex items-center gap-3">
        <WarningCircle weight="duotone" className="w-5 h-5" />
        <span className="flex-1 text-sm font-medium">
          Error loading companies: {error}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchOrgs}
          className="bg-white"
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            Registered Organizations
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage transport companies and their configurations.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchOrgs}
            className="rounded-xl h-10 px-4"
          >
            <ArrowClockwise className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          {onCreateClick && (
            <Button
              onClick={onCreateClick}
              className="rounded-xl h-10 px-4 bg-[#3D5A3D] hover:bg-[#2D432D]"
            >
              <Plus weight="bold" className="mr-2 h-4 w-4" />
              Add Company
            </Button>
          )}
        </div>
      </div>

      <Card className="rounded-2xl border-slate-200 overflow-hidden shadow-sm">
        <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Buildings weight="duotone" className="w-5 h-5 text-slate-400" />
            Companies ({orgs.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/30 hover:bg-slate-50/30 border-slate-100">
                  <TableHead className="font-semibold text-slate-900 py-4">
                    Company Details
                  </TableHead>
                  <TableHead className="font-semibold text-slate-900">
                    Contact Person
                  </TableHead>
                  <TableHead className="font-semibold text-slate-900">
                    Operations
                  </TableHead>
                  <TableHead className="font-semibold text-slate-900">
                    Invite Status
                  </TableHead>
                  <TableHead className="font-semibold text-slate-900">
                    Created
                  </TableHead>
                  <TableHead className="text-right font-semibold text-slate-900 pr-6">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orgs.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="h-32 text-center text-slate-400 font-medium"
                    >
                      No organizations found.
                    </TableCell>
                  </TableRow>
                ) : (
                  orgs.map((org) => {
                    const status = org.onboarding_status;
                    const acceptedAt = org.accepted_at;

                    return (
                      <TableRow
                        key={org.id}
                        className="group hover:bg-slate-50/50 transition-colors border-slate-100"
                      >
                        <TableCell className="py-4">
                          <div className="space-y-1">
                            <div className="font-bold text-slate-900 flex items-center gap-1.5">
                              {org.name}
                            </div>
                            <div className="flex flex-col gap-0.5">
                              <span className="font-mono text-[10px] text-slate-400 uppercase tracking-tight bg-white px-1.5 py-0.5 rounded border border-slate-100 w-fit">
                                {org.slug}
                              </span>
                              {org.billing_email && (
                                <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
                                  <EnvelopeSimple
                                    weight="duotone"
                                    className="w-3.5 h-3.5"
                                  />
                                  {org.billing_email}
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1.5">
                            {org.contact_name ? (
                              <div className="flex items-center gap-2 text-sm text-slate-700 font-medium">
                                <User
                                  weight="duotone"
                                  className="w-4 h-4 text-slate-400"
                                />
                                {org.contact_name}
                              </div>
                            ) : (
                              <span className="text-xs text-slate-300 italic">
                                No contact specified
                              </span>
                            )}
                            {org.contact_phone && (
                              <div className="flex items-center gap-2 text-xs text-slate-500 bg-white border border-slate-100 px-2 py-0.5 rounded-full w-fit">
                                <Phone
                                  weight="fill"
                                  className="w-3 h-3 text-[#3D5A3D]"
                                />
                                {formatPhoneNumber(org.contact_phone)}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                              <MapPin
                                weight="duotone"
                                className="w-4 h-4 text-red-500"
                              />
                              {org.operating_state || "Unknown State"}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-slate-600 bg-blue-50/50 border border-blue-100 px-2 py-0.5 rounded-full w-fit font-medium">
                              <Globe
                                weight="duotone"
                                className="w-3.5 h-3.5 text-blue-500"
                              />
                              {getTimezoneLabel(org.timezone)}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {status === "accepted" ? (
                            <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-bold bg-emerald-50 px-2.5 py-1 rounded-full w-fit">
                              <CheckCircle weight="fill" className="w-4 h-4" />
                              Accepted{" "}
                              {acceptedAt &&
                                format(new Date(acceptedAt), "MMM d")}
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 text-xs text-amber-600 font-bold bg-amber-50 px-2.5 py-1 rounded-full w-fit">
                              <Clock weight="fill" className="w-4 h-4" />
                              Pending
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-slate-500 font-medium whitespace-nowrap">
                            {format(new Date(org.created_at), "MMM d, yyyy")}
                          </span>
                        </TableCell>
                        <TableCell className="text-right pr-6">
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                              onClick={() => handleEditClick(org)}
                            >
                              <PencilSimple weight="bold" className="h-4 w-4" />
                              <span className="sr-only">Edit</span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg"
                              onClick={() => handleDelete(org.id, org.name)}
                            >
                              <Trash weight="bold" className="h-4 w-4" />
                              <span className="sr-only">Delete</span>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Edit Organization Dialog */}
      <Dialog
        open={!!editingOrg}
        onOpenChange={(open) => !open && setEditingOrg(null)}
      >
        <DialogContent className="sm:max-w-[540px] p-0 overflow-hidden rounded-2xl border-none shadow-2xl">
          <DialogHeader className="p-6 bg-slate-50 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center shadow-sm">
                <Buildings
                  weight="duotone"
                  className="w-6 h-6 text-[#3D5A3D]"
                />
              </div>
              <div className="text-left">
                <DialogTitle className="text-xl font-bold text-slate-900">
                  Edit Organization
                </DialogTitle>
                <DialogDescription className="text-slate-500">
                  Updates will take effect immediately.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="p-6 space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-slate-700 font-semibold text-xs flex items-center gap-1.5 tracking-wide">
                  Company Name
                </Label>
                <Input
                  value={editForm.name || ""}
                  onChange={(e) =>
                    setEditForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="Organization name"
                  className="rounded-xl bg-slate-50/50 border-slate-200 h-11 focus:bg-white transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-700 font-semibold text-xs flex items-center gap-1.5 tracking-wide">
                  Operating State
                </Label>
                <StateSelector
                  value={editForm.operating_state || ""}
                  onValueChange={(val) =>
                    setEditForm((prev) => ({
                      ...prev,
                      operating_state: val,
                    }))
                  }
                  className="w-full bg-slate-50/50"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-slate-700 font-semibold text-xs flex items-center gap-1.5 tracking-wide">
                Billing Email
              </Label>
              <Input
                type="email"
                value={editForm.billing_email || ""}
                onChange={(e) =>
                  setEditForm((prev) => ({
                    ...prev,
                    billing_email: e.target.value,
                  }))
                }
                placeholder="billing@company.com"
                className="rounded-xl bg-slate-50/50 border-slate-200 h-11 focus:bg-white transition-all"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-slate-700 font-semibold text-xs flex items-center gap-1.5 tracking-wide">
                  Contact Person
                </Label>
                <Input
                  value={editForm.contact_name || ""}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      contact_name: e.target.value,
                    }))
                  }
                  placeholder="Full name"
                  className="rounded-xl bg-slate-50/50 border-slate-200 h-11 focus:bg-white transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-700 font-semibold text-xs flex items-center gap-1.5 tracking-wide">
                  Onboarding Status
                </Label>
                <select
                  value={editForm.onboarding_status || "pending"}
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      onboarding_status: e.target.value as any,
                      // Auto-set accepted_at to now if moving to accepted and currently null
                      accepted_at:
                        e.target.value === "accepted" && !prev.accepted_at
                          ? new Date().toISOString()
                          : prev.accepted_at,
                    }))
                  }
                  className="rounded-xl bg-slate-50/50 border-slate-200 h-11 focus:bg-white transition-all w-full px-3 text-sm font-medium border focus:ring-1 focus:ring-[#3D5A3D]/20 outline-none"
                >
                  <option value="pending">Pending</option>
                  <option value="accepted">Accepted</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-slate-700 font-semibold text-xs flex items-center gap-1.5 tracking-wide">
                  Invitation Phone
                </Label>
                <Input
                  value={
                    editForm.contact_phone
                      ? formatPhoneNumber(editForm.contact_phone)
                      : ""
                  }
                  onChange={(e) =>
                    setEditForm((prev) => ({
                      ...prev,
                      contact_phone: formatPhoneNumber(e.target.value),
                    }))
                  }
                  placeholder="(555) 000-0000"
                  className="rounded-xl bg-slate-50/50 border-slate-200 h-11 focus:bg-white transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <Label className="text-slate-700 font-semibold text-xs flex items-center gap-1.5 tracking-wide">
                  Primary Timezone
                </Label>
                <TimezoneSelector
                  value={editForm.timezone || ""}
                  onValueChange={(tz) =>
                    setEditForm((prev) => ({ ...prev, timezone: tz }))
                  }
                  className="w-full h-11"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-700 font-semibold text-xs flex items-center gap-1.5 tracking-wide">
                  Invitation Status
                </Label>
                <div className="flex flex-col gap-2">
                  <div className="relative">
                    <Calendar
                      weight="duotone"
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"
                    />
                    <Input
                      type="datetime-local"
                      value={
                        editForm.accepted_at
                          ? format(
                              new Date(editForm.accepted_at),
                              "yyyy-MM-dd'T'HH:mm",
                            )
                          : ""
                      }
                      onChange={(e) => {
                        const date = e.target.value;
                        setEditForm((prev) => ({
                          ...prev,
                          accepted_at: date
                            ? new Date(date).toISOString()
                            : null,
                          // Sync onboarding_status if date is set
                          onboarding_status: date ? "accepted" : "pending",
                        }));
                      }}
                      className="rounded-xl bg-slate-50/50 border-slate-200 h-11 focus:bg-white transition-all pl-10"
                    />
                  </div>
                  {!editForm.accepted_at && (
                    <span className="text-[10px] text-amber-600 font-bold px-2 italic">
                      Currently Pending
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="p-6 bg-slate-50 border-t border-slate-100">
            <Button
              variant="outline"
              onClick={() => setEditingOrg(null)}
              className="rounded-xl h-11 px-6 border-slate-200"
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={isUpdating}
              className="rounded-xl h-11 px-6 bg-[#3D5A3D] hover:bg-[#2D432D] shadow-lg shadow-emerald-900/10 min-w-[120px]"
            >
              {isUpdating ? (
                <>
                  <CircleNotch className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
