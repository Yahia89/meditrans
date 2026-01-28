import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Trip, TripStatus, TripStatusHistory } from "./types";
import { Button } from "@/components/ui/button";
import {
  Pencil,
  Trash,
  MapPin,
  Calendar,
  Clock,
  FileText,
  CheckCircle,
  User,
  Car,
  Phone,
  Envelope,
  DotsThreeVertical,
  Warning,
  HandPointing,
  CaretLeft,
  Path,
  ArrowsClockwise,
  Signature,
  PencilSimpleLine,
  FilePdf,
  DownloadSimple,
} from "@phosphor-icons/react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import { usePermissions } from "@/hooks/usePermissions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useState, useEffect } from "react";
import { SignatureCaptureDialog, SignatureDisplay } from "./SignatureCapture";
import { generateTripSummaryPDF } from "@/utils/pdf-generator";

interface TripDetailsProps {
  tripId: string;
  onEdit?: (id: string) => void;
  onDeleteSuccess?: () => void;
  onBack?: () => void;
  onNavigate?: (id: string) => void;
}

function RelatedTripsTimeline({
  currentTripId,
  patientId,
  date,
  onNavigate,
  canManage,
  onEditMileage,
}: {
  currentTripId: string;
  patientId: string;
  date: string;
  onNavigate: (id: string) => void;
  canManage?: boolean;
  onEditMileage?: (trip: Trip) => void;
}) {
  const { data: trips } = useQuery({
    queryKey: ["patient-daily-trips", patientId, date],
    queryFn: async () => {
      // Use start/end of day logic
      const d = new Date(date);
      const start = new Date(
        d.getFullYear(),
        d.getMonth(),
        d.getDate(),
        0,
        0,
        0,
      ).toISOString();
      const end = new Date(
        d.getFullYear(),
        d.getMonth(),
        d.getDate(),
        23,
        59,
        59,
      ).toISOString();

      const { data, error } = await supabase
        .from("trips")
        .select("*")
        .eq("patient_id", patientId)
        .gte("pickup_time", start)
        .lte("pickup_time", end)
        .order("pickup_time", { ascending: true });

      if (error) throw error;
      return data as Trip[];
    },
    enabled: !!patientId && !!date,
  });

  if (!trips || trips.length <= 1) return null;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
      <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-6">
        Journey Timeline
      </h3>
      <div className="relative">
        {/* Connector Line */}
        <div className="absolute left-[15px] top-6 bottom-6 w-0.5 bg-slate-100" />

        <div className="space-y-6">
          {trips.map((trip, idx) => {
            const isCurrent = trip.id === currentTripId;
            // Calculate total journey distance
            const totalDistance = trips.reduce(
              (sum, t) =>
                sum +
                (Number(t.actual_distance_miles || t.distance_miles) || 0),
              0,
            );
            return (
              <div key={trip.id} className="relative pl-10 group">
                {/* Visual Node */}
                <div
                  className={cn(
                    "absolute left-0 top-1 w-8 h-8 rounded-xl border-2 flex items-center justify-center transition-all duration-300 z-10",
                    isCurrent
                      ? "bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-200"
                      : "bg-white border-slate-200 text-slate-400 group-hover:border-blue-300 group-hover:text-blue-400",
                  )}
                >
                  <span className="text-xs font-bold">{idx + 1}</span>
                </div>

                {/* Content */}
                <div
                  onClick={() => !isCurrent && onNavigate(trip.id)}
                  className={cn(
                    "rounded-xl border p-3 transition-all",
                    isCurrent
                      ? "bg-blue-50 border-blue-200 ring-1 ring-blue-100 cursor-default"
                      : "bg-white border-slate-100 hover:border-slate-300 hover:shadow-md cursor-pointer",
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className={cn(
                        "text-sm font-bold",
                        isCurrent ? "text-blue-900" : "text-slate-700",
                      )}
                    >
                      {new Date(trip.pickup_time).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <span
                      className={cn(
                        "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border",
                        trip.status === "completed"
                          ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                          : trip.status === "in_progress"
                            ? "bg-blue-100 text-blue-700 border-blue-200"
                            : "bg-slate-100 text-slate-600 border-slate-200",
                      )}
                    >
                      {trip.status.replace("_", " ")}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-rose-400 mt-1.5 shrink-0" />
                      <span
                        className="text-xs text-slate-600 line-clamp-1"
                        title={trip.pickup_location}
                      >
                        {trip.pickup_location}
                      </span>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                      <span
                        className="text-xs text-slate-600 line-clamp-1"
                        title={trip.dropoff_location}
                      >
                        {trip.dropoff_location}
                      </span>
                    </div>
                  </div>

                  {/* Distance Badge for this leg */}
                  {trip.distance_miles && (
                    <div className="mt-2 pt-2 border-t border-slate-100/80">
                      <div
                        className={cn(
                          "inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-semibold",
                          isCurrent
                            ? "bg-blue-100 text-blue-700"
                            : "bg-slate-100 text-slate-600",
                        )}
                      >
                        <Path weight="bold" className="w-3.5 h-3.5" />
                        {Math.ceil(
                          Number(
                            trip.actual_distance_miles || trip.distance_miles,
                          ),
                        )}{" "}
                        miles
                        {isCurrent &&
                          trip.status === "completed" &&
                          canManage &&
                          onEditMileage && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onEditMileage(trip);
                              }}
                              className="ml-1 p-1 hover:bg-blue-200 rounded-full text-blue-600 transition-colors"
                              title="Edit Mileage"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                          )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Show total distance only on the last item if it's the current trip */}
                {idx === trips.length - 1 && totalDistance > 0 && (
                  <div className="mt-3 pl-2">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Path weight="duotone" className="w-4 h-4" />
                      <span className="font-semibold">Total Journey:</span>
                      <span className="text-slate-700 font-bold">
                        {Math.ceil(totalDistance)} miles
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function EditMileageDialog({
  isOpen,
  onOpenChange,
  trip,
  onConfirm,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  trip: Trip | null;
  onConfirm: (miles: number) => void;
}) {
  const [miles, setMiles] = useState<string>("");

  useEffect(() => {
    if (trip && isOpen) {
      setMiles(
        (trip.actual_distance_miles || trip.distance_miles || 0).toString(),
      );
    }
  }, [trip, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm(parseFloat(miles));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-2xl">
        <DialogHeader>
          <DialogTitle>Edit Trip Mileage</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">
              Actual Distance (Miles)
            </label>
            <div className="relative">
              <Input
                type="number"
                step="0.1"
                required
                value={miles}
                onChange={(e) => setMiles(e.target.value)}
                className="pl-9"
              />
              <div className="absolute left-3 top-2.5 text-slate-400">
                <Path className="w-4 h-4" />
              </div>
            </div>
            <p className="text-xs text-slate-500">
              Update the mileage for accurate billing and reporting.
            </p>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit">Save Changes</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function TripDetails({
  tripId,
  onEdit,
  onDeleteSuccess,
  onBack,
  onNavigate,
}: TripDetailsProps) {
  const { user, profile } = useAuth();
  const { canManageTrips } = usePermissions();
  const queryClient = useQueryClient();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [statusToUpdate, setStatusToUpdate] = useState<TripStatus | null>(null);
  const [cancelReason, setCancelReason] = useState<string>("");
  const [cancelExplanation, setCancelExplanation] = useState<string>("");
  const [showSignatureDialog, setShowSignatureDialog] = useState(false);
  const [editingMileageTrip, setEditingMileageTrip] = useState<Trip | null>(
    null,
  );

  const { data: trip, isLoading } = useQuery({
    queryKey: ["trip", tripId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trips")
        .select(
          `
                    *,
                    patient:patients(id, full_name, phone, email, created_at, user_id),
                    driver:drivers(id, full_name, phone, email, user_id, vehicle_info)
                `,
        )
        .eq("id", tripId)
        .single();
      if (error) throw error;
      return data as Trip;
    },
  });

  const { data: history } = useQuery({
    queryKey: ["trip-history", tripId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trip_status_history")
        .select("*")
        .eq("trip_id", tripId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as TripStatusHistory[];
    },
    enabled: !!tripId,
  });

  // Fetch related trips for the journey timeline (same day) to pass to PDF
  const { data: journeyTrips } = useQuery({
    queryKey: ["patient-daily-trips", trip?.patient_id, trip?.pickup_time],
    queryFn: async () => {
      if (!trip?.patient_id || !trip?.pickup_time) return [];

      const d = new Date(trip.pickup_time);
      const start = new Date(
        d.getFullYear(),
        d.getMonth(),
        d.getDate(),
        0,
        0,
        0,
      ).toISOString();
      const end = new Date(
        d.getFullYear(),
        d.getMonth(),
        d.getDate(),
        23,
        59,
        59,
      ).toISOString();

      const { data, error } = await supabase
        .from("trips")
        .select("*")
        .eq("patient_id", trip.patient_id)
        .gte("pickup_time", start)
        .lte("pickup_time", end)
        .order("pickup_time", { ascending: true });

      if (error) throw error;
      return data as Trip[];
    },
    enabled: !!trip?.patient_id && !!trip?.pickup_time,
  });

  // Fetch organization name
  const { data: org } = useQuery({
    queryKey: ["organization", trip?.org_id],
    queryFn: async () => {
      if (!trip?.org_id) return null;
      const { data, error } = await supabase
        .from("organizations")
        .select("name")
        .eq("id", trip.org_id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!trip?.org_id,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({
      status,
      cancelReason,
      cancelExplanation,
    }: {
      status: TripStatus;
      cancelReason?: string;
      cancelExplanation?: string;
    }) => {
      const updates: any = {
        status: status,
        status_requested: null,
        status_requested_at: null,
      };

      if (cancelReason) updates.cancel_reason = cancelReason;
      if (cancelExplanation) updates.cancel_explanation = cancelExplanation;

      const { error } = await supabase
        .from("trips")
        .update(updates)
        .eq("id", tripId);

      if (error) throw error;

      // Log to history
      await supabase.from("trip_status_history").insert({
        trip_id: tripId,
        status: status,
        actor_id: user?.id,
        actor_name: profile?.full_name || user?.email || "System",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trip", tripId] });
      queryClient.invalidateQueries({ queryKey: ["trips"] });
      queryClient.invalidateQueries({ queryKey: ["trip-history", tripId] });
    },
  });

  const updateMileageMutation = useMutation({
    mutationFn: async ({
      tripId,
      miles,
    }: {
      tripId: string;
      miles: number;
    }) => {
      const { error } = await supabase
        .from("trips")
        .update({
          actual_distance_miles: miles,
        })
        .eq("id", tripId);

      if (error) throw error;

      await supabase.from("trip_status_history").insert({
        trip_id: tripId,
        status: `UPDATED: Distance ${miles} miles`,
        actor_id: user?.id,
        actor_name: profile?.full_name || user?.email || "System",
      });
    },
    onSuccess: () => {
      setEditingMileageTrip(null);
      queryClient.invalidateQueries({ queryKey: ["trip", tripId] });
      queryClient.invalidateQueries({ queryKey: ["trips"] });
      queryClient.invalidateQueries({ queryKey: ["trip-history", tripId] });
      queryClient.invalidateQueries({
        queryKey: ["patient-daily-trips", trip?.patient_id],
      });
    },
  });

  const deleteTripMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("trips").delete().eq("id", tripId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trips"] });
      onDeleteSuccess?.();
    },
  });

  // Signature capture mutation
  const signatureCaptureMutation = useMutation({
    mutationFn: async ({
      signatureData,
      signedByName,
      declined,
      declinedReason,
    }: {
      signatureData?: string;
      signedByName?: string;
      declined?: boolean;
      declinedReason?: string;
    }) => {
      // Calculate actual distance and duration using Google Maps Directions API
      let actualDistance: number | null = null;
      let actualDuration: number | null = null;

      try {
        if (trip && import.meta.env.VITE_GOOGLE_MAPS_API_KEY) {
          const directionsUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(
            trip.pickup_location,
          )}&destination=${encodeURIComponent(trip.dropoff_location)}&key=${
            import.meta.env.VITE_GOOGLE_MAPS_API_KEY
          }`;

          const response = await fetch(directionsUrl);
          const data = await response.json();

          if (data.status === "OK" && data.routes?.[0]?.legs?.[0]?.distance) {
            // Convert meters to miles and round up to nearest whole mile
            const meters = data.routes[0].legs[0].distance.value;
            actualDistance = Math.ceil(meters / 1609.34);

            // Convert seconds to minutes and round
            const seconds = data.routes[0].legs[0].duration.value;
            actualDuration = Math.round(seconds / 60);
          }
        }
      } catch (err) {
        console.error("Error calculating actual distance:", err);
        // Continue anyway with null metrics
      }

      const updates: Record<string, unknown> = {
        status: "completed",
        signature_captured_at: new Date().toISOString(),
        actual_distance_miles: actualDistance,
        actual_duration_minutes: actualDuration,
      };

      if (declined) {
        updates.signature_declined = true;
        updates.signature_declined_reason = declinedReason;
      } else {
        updates.signature_data = signatureData;
        updates.signed_by_name = signedByName;
      }

      const { error } = await supabase
        .from("trips")
        .update(updates)
        .eq("id", tripId);

      if (error) throw error;

      // Log to history
      await supabase.from("trip_status_history").insert({
        trip_id: tripId,
        status: declined
          ? "COMPLETED (Signature Declined)"
          : "COMPLETED WITH SIGNATURE",
        actor_id: user?.id,
        actor_name: profile?.full_name || user?.email || "Driver",
      });
    },
    onSuccess: () => {
      setShowSignatureDialog(false);
      queryClient.invalidateQueries({ queryKey: ["trip", tripId] });
      queryClient.invalidateQueries({ queryKey: ["trips"] });
      queryClient.invalidateQueries({ queryKey: ["trip-history", tripId] });
    },
  });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <DotsThreeVertical className="h-8 w-8 animate-pulse text-slate-300" />
      </div>
    );
  }

  if (!trip) return <div>Trip not found</div>;

  const isDesignatedDriver = trip.driver?.user_id === user?.id;
  const canManage = canManageTrips;

  const handleStatusUpdate = (status: TripStatus) => {
    if (status === "cancelled" || status === "no_show") {
      setStatusToUpdate(status);
    } else {
      updateStatusMutation.mutate({
        status,
      });
    }
  };

  const confirmStatusUpdate = () => {
    if (!statusToUpdate) return;

    updateStatusMutation.mutate({
      status: statusToUpdate,
      cancelReason: statusToUpdate === "cancelled" ? cancelReason : undefined,
      cancelExplanation:
        statusToUpdate === "cancelled" && cancelReason === "other"
          ? cancelExplanation
          : undefined,
    });

    setStatusToUpdate(null);
    setCancelReason("");
    setCancelExplanation("");
  };

  // Build a comprehensive timeline from trip data and history
  const buildTimeline = () => {
    const events: Array<{
      id: string;
      status: string;
      actor_name: string;
      created_at: string;
    }> = [];

    // Add real history events first
    if (history && history.length > 0) {
      history.forEach((item) => {
        events.push({
          id: item.id,
          status: item.status,
          actor_name: item.actor_name,
          created_at: item.created_at,
        });
      });
    }

    // Current status event - only show if history doesn't already capture the latest change
    const hasHistoryForStatus = (status: string) =>
      events.some((e) => e.status.toLowerCase().includes(status.toLowerCase()));

    if (trip.status && !hasHistoryForStatus(trip.status)) {
      events.push({
        id: `current-${trip.status}`,
        status: trip.status.toUpperCase(),
        actor_name: trip.driver?.full_name || "System",
        created_at: trip.updated_at || trip.created_at,
      });
    }

    // Sort by date descending (most recent first)
    return events.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  };

  const timelineEvents = buildTimeline();

  return (
    <div className="space-y-6">
      {onBack && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-900 -ml-2 h-9 px-3 rounded-xl transition-colors"
        >
          <CaretLeft weight="bold" className="w-4 h-4" />
          Back to Trips
        </Button>
      )}

      {/* Trip Actions Section - Only shown for relevant users */}
      {(isDesignatedDriver || canManage) && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 md:p-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-1">
                <h2 className="text-xl font-bold text-slate-900">
                  Trip Status
                </h2>
                <p className="text-sm text-slate-500">
                  Manage the progression of this journey in real-time
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Details */}
        <div className="lg:col-span-2 space-y-8">
          {/* Trip Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-8">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div className="space-y-1">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                    Trip Type
                  </p>
                  <h2 className="text-xl font-bold text-slate-900">
                    {trip.trip_type}
                  </h2>
                </div>
                <div className="flex items-center gap-2 self-start md:self-auto">
                  {canManage && (
                    <div className="flex items-center gap-2 mr-2">
                      {onEdit && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onEdit(tripId)}
                          className="h-8 gap-2 rounded-lg border-slate-200 text-slate-600 hover:bg-slate-50"
                        >
                          <Pencil weight="duotone" className="w-4 h-4" />
                          Edit
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsDeleteDialogOpen(true)}
                        className="h-8 w-8 p-0 rounded-lg border-slate-200 text-slate-400 hover:text-red-600 hover:border-red-100 hover:bg-red-50"
                      >
                        <Trash weight="duotone" className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                  <div
                    className={cn(
                      "px-4 py-1.5 rounded-full text-[11px] font-bold tracking-wider border uppercase",
                      trip.status === "completed"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                        : trip.status === "in_progress"
                          ? "bg-blue-50 text-blue-700 border-blue-100"
                          : trip.status === "cancelled" ||
                              trip.status === "no_show"
                            ? "bg-red-50 text-red-700 border-red-100"
                            : "bg-slate-50 text-slate-600 border-slate-200",
                    )}
                  >
                    {trip.status.replace("_", " ")}
                  </div>
                </div>
              </div>

              {trip.status === "cancelled" && trip.cancel_reason && (
                <div className="mb-8 p-4 bg-red-50 border border-red-100 rounded-xl">
                  <p className="text-xs font-bold text-red-400 uppercase tracking-widest mb-1">
                    Cancellation Reason
                  </p>
                  <p className="text-sm font-bold text-red-900">
                    {trip.cancel_reason === "other"
                      ? trip.cancel_explanation
                      : trip.cancel_reason}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                <div className="space-y-6">
                  <div className="flex gap-4">
                    <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center flex-shrink-0">
                      <MapPin
                        weight="duotone"
                        className="w-5 h-5 text-rose-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        Pickup Location
                      </p>
                      <p className="text-sm font-medium text-slate-900 leading-relaxed">
                        {trip.pickup_location}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center flex-shrink-0">
                      <MapPin
                        weight="duotone"
                        className="w-5 h-5 text-slate-400"
                      />
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        Dropoff Location
                      </p>
                      <p className="text-sm font-medium text-slate-900 leading-relaxed">
                        {trip.dropoff_location}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="flex gap-4">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                      <Calendar
                        weight="duotone"
                        className="w-5 h-5 text-blue-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        Scheduled Date
                      </p>
                      <p className="text-sm font-medium text-slate-900">
                        {new Date(trip.pickup_time).toLocaleDateString(
                          undefined,
                          {
                            weekday: "long",
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          },
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
                      <Clock
                        weight="duotone"
                        className="w-5 h-5 text-amber-600"
                      />
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        Pickup Time
                      </p>
                      <p className="text-sm font-medium text-slate-900">
                        {new Date(trip.pickup_time).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {trip.notes && (
                <div className="mt-12 p-6 bg-slate-50/50 rounded-2xl border border-slate-100">
                  <div className="flex items-center gap-2 mb-3">
                    <FileText
                      weight="duotone"
                      className="w-4 h-4 text-slate-400"
                    />
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                      Special Instructions
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed font-medium">
                    {trip.notes}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Driver Actions */}
          {(isDesignatedDriver || canManage) && (
            <div className="bg-slate-50 rounded-2xl border border-slate-200 p-8 shadow-sm">
              <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center shadow-sm">
                    <HandPointing
                      weight="duotone"
                      className="w-6 h-6 text-slate-600"
                    />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">
                      {isDesignatedDriver
                        ? "Driver Actions"
                        : "Trip Management"}
                    </h3>
                    <p className="text-sm text-slate-600">
                      Manage the current state of this trip.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3 w-full md:w-auto">
                  {/* Status Flow Buttons - Moved to right for better flow */}

                  {/* Terminal Statuses (Secondary) */}
                  {!["completed", "cancelled", "no_show"].includes(
                    trip.status,
                  ) && (
                    <>
                      <Button
                        variant="outline"
                        onClick={() => handleStatusUpdate("no_show")}
                        className="flex-1 md:flex-none border-orange-200 text-orange-700 hover:bg-orange-50 font-bold h-11 px-6 rounded-xl transition-all duration-300"
                      >
                        No Show
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleStatusUpdate("cancelled")}
                        className="flex-1 md:flex-none border-red-200 text-red-600 hover:bg-red-50 font-bold h-11 px-6 rounded-xl transition-all duration-300"
                      >
                        Cancel
                      </Button>
                    </>
                  )}

                  {/* New Simplified & Descriptive Flow */}
                  {(trip.status === "assigned" ||
                    trip.status === "accepted") && (
                    <Button
                      onClick={() => handleStatusUpdate("en_route")}
                      className="flex-1 md:flex-none bg-purple-600 hover:bg-purple-700 text-white font-bold h-11 px-8 rounded-xl"
                    >
                      Start Driving to Pickup
                    </Button>
                  )}

                  {trip.status === "en_route" && (
                    <Button
                      onClick={() => handleStatusUpdate("arrived")}
                      className="flex-1 md:flex-none bg-amber-500 hover:bg-amber-600 text-white font-bold h-11 px-8 rounded-xl"
                    >
                      Arrived at Pickup
                    </Button>
                  )}

                  {trip.status === "arrived" && (
                    <Button
                      onClick={() => handleStatusUpdate("in_progress")}
                      className="flex-1 md:flex-none bg-blue-600 hover:bg-blue-700 text-white font-bold h-11 px-8 rounded-xl"
                    >
                      Pickup Patient
                    </Button>
                  )}

                  {trip.status === "in_progress" && (
                    <Button
                      onClick={() => setShowSignatureDialog(true)}
                      className="flex-1 md:flex-none bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-11 px-8 rounded-xl transition-all duration-300"
                    >
                      <Signature weight="bold" className="w-5 h-5 mr-2" />
                      Arrived at Destination / Drop Off
                    </Button>
                  )}

                  {trip.status === "completed" && (
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-3 px-6 py-2 bg-emerald-50 rounded-xl border border-emerald-100 text-emerald-700 font-bold shadow-sm">
                        <CheckCircle
                          weight="duotone"
                          className="w-6 h-6 text-emerald-500"
                        />
                        Trip Completed
                        {trip.signature_data && (
                          <span className="text-xs bg-emerald-100 px-2 py-0.5 rounded-full ml-1">
                            Signed
                          </span>
                        )}
                        {trip.signature_declined && (
                          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full ml-1">
                            Signature Declined
                          </span>
                        )}
                      </div>

                      <Button
                        variant="outline"
                        onClick={() =>
                          generateTripSummaryPDF(
                            trip,
                            journeyTrips || [],
                            history || [],
                            org?.name,
                          )
                        }
                        className="h-11 border-slate-200 text-slate-600 hover:text-slate-900 hover:border-slate-300 font-bold px-4 rounded-xl gap-2 transition-all shadow-sm bg-white"
                      >
                        <FilePdf
                          weight="duotone"
                          className="w-5 h-5 text-red-500"
                        />
                        Download Summary
                        <DownloadSimple
                          weight="bold"
                          className="w-4 h-4 ml-1 opacity-50"
                        />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Side Information */}
        <div className="flex flex-col gap-6">
          {/* Related Trips / Journey Timeline */}
          {trip.patient_id && (
            <RelatedTripsTimeline
              currentTripId={trip.id}
              patientId={trip.patient_id}
              date={trip.pickup_time}
              onNavigate={(id) => onNavigate?.(id)}
              canManage={canManage}
              onEditMileage={(t) => setEditingMileageTrip(t)}
            />
          )}

          {/* Patient Profile */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-6">
              Patient Profile
            </h3>
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center">
                <User weight="duotone" className="text-blue-600 w-6 h-6" />
              </div>
              <div>
                <p className="font-bold text-slate-900">
                  {trip.patient?.full_name}
                </p>
                <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mt-0.5">
                  Member since{" "}
                  {trip.patient?.created_at
                    ? new Date(trip.patient.created_at).getFullYear()
                    : "2025"}
                </p>
              </div>
            </div>
            <div className="space-y-4 pt-6 border-t border-slate-50">
              <div className="flex items-center gap-3 text-sm font-medium text-slate-600">
                <Phone weight="duotone" className="w-5 h-5 text-slate-400" />
                {trip.patient?.phone}
              </div>
              <div className="flex items-center gap-3 text-sm font-medium text-slate-600 truncate">
                <Envelope
                  weight="duotone"
                  className="w-5 h-5 text-slate-400 shrink-0"
                />
                <span className="truncate">{trip.patient?.email}</span>
              </div>
            </div>
          </div>

          {/* Driver Profile */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-6">
              Assigned Driver
            </h3>
            {trip.driver ? (
              <>
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center">
                    <Car
                      weight="duotone"
                      className="text-emerald-600 w-6 h-6"
                    />
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">
                      {trip.driver?.full_name}
                    </p>
                    <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mt-0.5">
                      Vehicle: {trip.driver?.vehicle_info || "SEDAN"}
                    </p>
                  </div>
                </div>
                <div className="space-y-4 pt-6 border-t border-slate-50">
                  <div className="flex items-center gap-3 text-sm font-medium text-slate-600">
                    <Phone
                      weight="duotone"
                      className="w-5 h-5 text-slate-400"
                    />
                    {trip.driver?.phone || "Not available"}
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-8">
                <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-4">
                  <Car weight="duotone" className="text-slate-300 w-6 h-6" />
                </div>
                <p className="text-sm font-bold text-slate-400">
                  No driver assigned yet
                </p>
                {canManage && (
                  <Button
                    variant="link"
                    className="text-xs text-blue-600 font-bold p-0 h-auto mt-2"
                    onClick={() => onEdit?.(tripId)}
                  >
                    Assign Now
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Activity Timeline / History */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-6">
              Activity Timeline
            </h3>
            <div className="space-y-5">
              {timelineEvents.map((item, idx) => {
                // Determine event type for styling
                const isUpdate = item.status.includes("UPDATED");
                const isCreated = item.status.toLowerCase().includes("created");
                const isAssigned = item.status
                  .toLowerCase()
                  .includes("assigned");
                const isCompleted = item.status.toLowerCase() === "completed";
                const isRequest = item.status.includes("REQUEST");
                const isCancelOrReject =
                  item.status.includes("CANCEL") ||
                  item.status.includes("REJECTED");
                const isSignature = item.status
                  .toLowerCase()
                  .includes("signature");

                // Extract distance from update message if present
                const distanceMatch = item.status.match(
                  /DISTANCE:\s*([\d.]+)\s*MILES?/i,
                );
                const distance = distanceMatch
                  ? parseFloat(distanceMatch[1])
                  : null;

                // Clean up the status text for display
                let displayStatus = item.status.replace(/_/g, " ");
                // For updates, make it more readable
                if (isUpdate) {
                  displayStatus = displayStatus.replace("UPDATED:", "").trim();
                }

                return (
                  <div key={item.id} className="relative flex gap-3">
                    {idx !== timelineEvents.length - 1 && (
                      <div className="absolute left-[15px] top-10 bottom-[-20px] w-0.5 bg-slate-100" />
                    )}

                    {/* Event Icon */}
                    <div
                      className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border transition-all duration-300",
                        isCompleted
                          ? "bg-emerald-50 border-emerald-200"
                          : isCancelOrReject
                            ? "bg-red-50 border-red-200"
                            : isRequest
                              ? "bg-amber-50 border-amber-200"
                              : isAssigned
                                ? "bg-blue-50 border-blue-200"
                                : isUpdate
                                  ? "bg-slate-50 border-slate-200"
                                  : isSignature
                                    ? "bg-indigo-50 border-indigo-200"
                                    : isCreated
                                      ? "bg-slate-50 border-slate-200"
                                      : "bg-slate-50 border-slate-150",
                      )}
                    >
                      {isCompleted ? (
                        <CheckCircle
                          weight="duotone"
                          className="w-4 h-4 text-emerald-600"
                        />
                      ) : isCancelOrReject ? (
                        <Warning
                          weight="duotone"
                          className="w-4 h-4 text-red-500"
                        />
                      ) : isRequest ? (
                        <Clock
                          weight="duotone"
                          className="w-4 h-4 text-amber-500"
                        />
                      ) : isAssigned ? (
                        <Car
                          weight="duotone"
                          className="w-4 h-4 text-blue-500"
                        />
                      ) : isUpdate ? (
                        <PencilSimpleLine
                          weight="duotone"
                          className="w-4 h-4 text-slate-400"
                        />
                      ) : isSignature ? (
                        <Signature
                          weight="duotone"
                          className="w-4 h-4 text-indigo-500"
                        />
                      ) : isCreated ? (
                        <Calendar
                          weight="duotone"
                          className="w-4 h-4 text-slate-400"
                        />
                      ) : (
                        <ArrowsClockwise
                          weight="duotone"
                          className="w-4 h-4 text-slate-400"
                        />
                      )}
                    </div>

                    {/* Event Content */}
                    <div className="flex-1 min-w-0 pt-0.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          {isUpdate ? (
                            <div className="space-y-1">
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                Trip Updated
                              </p>
                              <div className="flex flex-wrap gap-1.5">
                                {displayStatus.split(",").map((change, i) => {
                                  const trimmed = change.trim();
                                  const isDistanceChange = trimmed
                                    .toLowerCase()
                                    .includes("distance");
                                  return (
                                    <span
                                      key={i}
                                      className={cn(
                                        "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium",
                                        isDistanceChange
                                          ? "bg-blue-50 text-blue-600 border border-blue-100"
                                          : "bg-slate-100 text-slate-600",
                                      )}
                                    >
                                      {isDistanceChange && (
                                        <Path
                                          weight="bold"
                                          className="w-3 h-3"
                                        />
                                      )}
                                      {trimmed}
                                    </span>
                                  );
                                })}
                              </div>
                            </div>
                          ) : (
                            <p
                              className={cn(
                                "text-sm font-bold uppercase tracking-tight",
                                isCompleted
                                  ? "text-emerald-700"
                                  : isCancelOrReject
                                    ? "text-red-600"
                                    : isRequest
                                      ? "text-amber-600"
                                      : "text-slate-800",
                              )}
                            >
                              {displayStatus}
                            </p>
                          )}
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            by{" "}
                            <span className="font-semibold text-slate-600">
                              {item.actor_name}
                            </span>
                          </p>
                        </div>
                        <time className="text-[10px] font-semibold text-slate-400 whitespace-nowrap shrink-0">
                          {new Date(item.created_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                          <span className="block text-[9px] font-normal text-slate-300">
                            {new Date(item.created_at).toLocaleDateString()}
                          </span>
                        </time>
                      </div>

                      {/* Special display for distance if parsed */}
                      {distance && !isUpdate && (
                        <div className="mt-1.5 inline-flex items-center gap-1.5 px-2 py-0.5 bg-blue-50 rounded text-xs font-semibold text-blue-600 border border-blue-100">
                          <Path weight="bold" className="w-3 h-3" />
                          {distance} miles
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Signature Display (for completed trips with signature) */}
          {trip.status === "completed" &&
            (trip.signature_data || trip.signature_declined) && (
              <SignatureDisplay
                signatureData={trip.signature_data}
                signedByName={trip.signed_by_name}
                capturedAt={trip.signature_captured_at}
                declined={trip.signature_declined}
                declinedReason={trip.signature_declined_reason}
              />
            )}
        </div>

        {/* Delete Confirmation */}
        <AlertDialog
          open={isDeleteDialogOpen}
          onOpenChange={setIsDeleteDialogOpen}
        >
          <AlertDialogContent className="rounded-2xl border-slate-200">
            <AlertDialogHeader>
              <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center mb-4">
                <Warning weight="duotone" className="w-6 h-6 text-red-600" />
              </div>
              <AlertDialogTitle className="text-xl font-bold text-slate-900">
                Delete Trip?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-slate-600">
                This action cannot be undone. This will permanently delete the
                trip for
                <span className="font-bold text-slate-900 ml-1">
                  {trip.patient?.full_name}
                </span>
                .
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="mt-6 gap-3">
              <AlertDialogCancel className="rounded-xl border-slate-200 font-bold h-11">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteTripMutation.mutate()}
                className="bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold h-11 px-8 shadow-lg shadow-red-200/50"
              >
                Delete Trip
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Status Update Dialog (Cancel/No Show) */}
        <Dialog
          open={!!statusToUpdate}
          onOpenChange={(open) => !open && setStatusToUpdate(null)}
        >
          <DialogContent className="max-w-md rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">
                {statusToUpdate === "cancelled"
                  ? "Cancel Trip"
                  : "Mark as No Show"}
              </DialogTitle>
            </DialogHeader>

            <div className="py-6 space-y-6">
              {statusToUpdate === "cancelled" && (
                <div className="space-y-3">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                    Cancellation Reason
                  </label>
                  <Select value={cancelReason} onValueChange={setCancelReason}>
                    <SelectTrigger className="h-12 rounded-xl border-slate-200 bg-slate-50/50">
                      <SelectValue placeholder="Select a reason" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-slate-200 shadow-xl">
                      <SelectItem value="late driver">Late Driver</SelectItem>
                      <SelectItem value="appointment cancel">
                        Appointment Canceled
                      </SelectItem>
                      <SelectItem value="other">Other (Explain)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {statusToUpdate === "cancelled" && cancelReason === "other" && (
                <div className="space-y-3">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                    Explanation
                  </label>
                  <Textarea
                    value={cancelExplanation}
                    onChange={(e) => setCancelExplanation(e.target.value)}
                    placeholder="Please explain why the trip is being canceled..."
                    className="min-h-[100px] rounded-xl border-slate-200 bg-slate-50/50"
                  />
                </div>
              )}

              <p className="text-sm text-slate-500 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-100">
                {statusToUpdate === "cancelled"
                  ? "Are you sure you want to cancel this trip? This action will notify relevant parties."
                  : "Are you sure you want to mark this patient as a No Show? This will update the trip status."}
              </p>
            </div>

            <DialogFooter className="gap-3">
              <Button
                variant="ghost"
                onClick={() => setStatusToUpdate(null)}
                className="rounded-xl font-bold text-slate-500 h-11"
              >
                Back
              </Button>
              <Button
                onClick={confirmStatusUpdate}
                disabled={
                  (statusToUpdate === "cancelled" && !cancelReason) ||
                  (cancelReason === "other" && !cancelExplanation)
                }
                className={cn(
                  "rounded-xl font-bold h-11 px-8 shadow-lg",
                  statusToUpdate === "cancelled"
                    ? "bg-red-600 hover:bg-red-700 text-white shadow-red-200/50"
                    : "bg-orange-600 hover:bg-orange-700 text-white shadow-orange-200/50",
                )}
              >
                Confirm{" "}
                {statusToUpdate === "cancelled" ? "Cancellation" : "No Show"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Signature Capture Dialog */}
        {trip && (
          <SignatureCaptureDialog
            open={showSignatureDialog}
            onOpenChange={setShowSignatureDialog}
            trip={trip}
            onSignatureCapture={({ signatureData, signedByName }) => {
              signatureCaptureMutation.mutate({ signatureData, signedByName });
            }}
            onSignatureDecline={(reason) => {
              signatureCaptureMutation.mutate({
                declined: true,
                declinedReason: reason,
              });
            }}
            isLoading={signatureCaptureMutation.isPending}
          />
        )}

        <EditMileageDialog
          isOpen={!!editingMileageTrip}
          onOpenChange={(open) => !open && setEditingMileageTrip(null)}
          trip={editingMileageTrip}
          onConfirm={(miles) => {
            if (editingMileageTrip) {
              updateMileageMutation.mutate({
                tripId: editingMileageTrip.id,
                miles,
              });
            }
          }}
        />
      </div>
    </div>
  );
}
