import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Trip, TripStatus } from "./types";
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
} from "@phosphor-icons/react";
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
import { useState } from "react";

interface TripDetailsProps {
  tripId: string;
  onEdit?: (id: string) => void;
  onDeleteSuccess?: () => void;
  onBack?: () => void;
}

export function TripDetails({
  tripId,
  onEdit,
  onDeleteSuccess,
  onBack,
}: TripDetailsProps) {
  const { user } = useAuth();
  const { isAdmin, isOwner } = usePermissions();
  const queryClient = useQueryClient();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

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
                `
        )
        .eq("id", tripId)
        .single();
      if (error) throw error;
      return data as Trip;
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({
      status,
      requestedByDriver,
    }: {
      status: TripStatus;
      requestedByDriver?: boolean;
    }) => {
      if (requestedByDriver) {
        // Foundation: Set requested status instead of immediate update
        const { error } = await supabase
          .from("trips")
          .update({
            status_requested: status,
            status_requested_at: new Date().toISOString(),
          })
          .eq("id", tripId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("trips")
          .update({ status: status })
          .eq("id", tripId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trip", tripId] });
      queryClient.invalidateQueries({ queryKey: ["trips"] });
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

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <DotsThreeVertical className="h-8 w-8 animate-pulse text-slate-300" />
      </div>
    );
  }

  if (!trip) return <div>Trip not found</div>;

  const isDesignatedDriver = trip.driver?.user_id === user?.id;
  const canManage = isAdmin || isOwner;
  const canAccept = isDesignatedDriver && trip.status === "assigned";
  const canStart = isDesignatedDriver && trip.status === "accepted";
  const canFinish = isDesignatedDriver && trip.status === "in_progress";

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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Details */}
        <div className="lg:col-span-2 space-y-8">
          {/* Trip Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-8">
              <div className="flex items-center justify-between mb-8">
                <div className="space-y-1">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                    Trip Type
                  </p>
                  <h2 className="text-xl font-bold text-slate-900">
                    {trip.trip_type} Transportation
                  </h2>
                </div>
                <div className="flex items-center gap-2">
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
                        ? "bg-slate-100 text-slate-600 border-slate-200"
                        : trip.status === "in_progress"
                        ? "bg-blue-50 text-blue-700 border-blue-100"
                        : trip.status === "cancelled"
                        ? "bg-red-50 text-red-700 border-red-100"
                        : "bg-emerald-50 text-emerald-700 border-emerald-100"
                    )}
                  >
                    {trip.status}
                  </div>
                </div>
              </div>

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
                          }
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
          {isDesignatedDriver && (
            <div className="bg-emerald-50 rounded-2xl border border-emerald-100 p-8 shadow-sm">
              <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-white border border-emerald-100 flex items-center justify-center shadow-sm">
                    <HandPointing
                      weight="duotone"
                      className="w-6 h-6 text-emerald-600"
                    />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-emerald-900">
                      Driver Actions
                    </h3>
                    <p className="text-sm text-emerald-700/80">
                      Manage the current state of this trip.
                    </p>
                  </div>
                </div>
                <div className="flex gap-4 w-full md:w-auto">
                  {canAccept && (
                    <Button
                      onClick={() =>
                        updateStatusMutation.mutate({ status: "accepted" })
                      }
                      className="flex-1 md:flex-none bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-11 px-8 rounded-xl shadow-lg shadow-emerald-200/50"
                    >
                      Accept Trip
                    </Button>
                  )}
                  {canStart && (
                    <Button
                      onClick={() =>
                        updateStatusMutation.mutate({ status: "in_progress" })
                      }
                      className="flex-1 md:flex-none bg-blue-600 hover:bg-blue-700 text-white font-bold h-11 px-8 rounded-xl shadow-lg shadow-blue-200/50"
                    >
                      Start Trip
                    </Button>
                  )}
                  {canFinish && (
                    <Button
                      onClick={() =>
                        updateStatusMutation.mutate({
                          status: "completed",
                          requestedByDriver: false,
                        })
                      }
                      className="flex-1 md:flex-none bg-slate-900 hover:bg-slate-800 text-white font-bold h-11 px-8 rounded-xl shadow-lg shadow-slate-200/50"
                    >
                      Finish Trip
                    </Button>
                  )}
                  {trip.status === "completed" && (
                    <div className="flex items-center gap-3 px-6 py-2 bg-white rounded-xl border border-emerald-100 text-emerald-700 font-bold shadow-sm">
                      <CheckCircle
                        weight="duotone"
                        className="w-6 h-6 text-emerald-500"
                      />
                      Trip Completed
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Side Information */}
        <div className="flex flex-col gap-6">
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
                  >
                    Assign Now
                  </Button>
                )}
              </div>
            )}
          </div>
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
      </div>
    </div>
  );
}
