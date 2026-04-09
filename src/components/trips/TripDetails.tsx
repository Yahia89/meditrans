import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Trip, TripStatus, TripStatusHistory } from "./types";
import { Button } from "@/components/ui/button";
import {
  DotsThreeVertical,
  CaretLeft,
} from "@phosphor-icons/react";
import React, { useState, useCallback } from "react";
import { SignatureCaptureDialog, SignatureDisplay } from "./SignatureCapture";
import { JourneyTimeline, useJourneyTrips } from "./JourneyTimeline";
import { useAuth } from "@/contexts/auth-context";
import { usePermissions } from "@/hooks/usePermissions";
import { useTimezone } from "@/hooks/useTimezone";

// Sub-components
import { TripInfoCard } from "./details/TripInfoCard";
import { TripStatusActions } from "./details/TripStatusActions";
import { TripMetrics } from "./details/TripMetrics";
import { PatientProfileCard, DriverProfileCard } from "./details/TripProfiles";
import { TripActivityTimeline } from "./details/TripActivityTimeline";
import { 
  DeleteConfirmationDialog, 
  StatusUpdateDialog, 
  EditMileageDialog, 
  EditWaitTimeDialog 
} from "./details/TripDetailsDialogs";

interface TripDetailsProps {
  tripId: string;
  onEdit?: (id: string) => void;
  onDeleteSuccess?: () => void;
  onBack?: () => void;
  onNavigate?: (id: string) => void;
}

export function TripDetails({
  tripId,
  onEdit,
  onDeleteSuccess,
  onBack,
  onNavigate,
}: TripDetailsProps) {
  const { user, profile } = useAuth();
  const { canManageTrips, canDeleteTrips } = usePermissions();
  const queryClient = useQueryClient();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [statusToUpdate, setStatusToUpdate] = useState<TripStatus | null>(null);
  const [showSignatureDialog, setShowSignatureDialog] = useState(false);
  const [editingMileageTrip, setEditingMileageTrip] = useState<Trip | null>(
    null,
  );
  const [editingWaitTimeTrip, setEditingWaitTimeTrip] = useState<Trip | null>(
    null,
  );
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  const activeTimezone = useTimezone();

  const handleNavigate = useCallback(
    (id: string) => {
      onNavigate?.(id);
    },
    [onNavigate],
  );

  const handleEditMileage = useCallback((t: Trip) => {
    setEditingMileageTrip(t);
  }, []);

  const handleEditWaitTime = useCallback((t: Trip) => {
    setEditingWaitTimeTrip(t);
  }, []);

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
    staleTime: 60 * 1000,
    placeholderData: (previousData) => previousData,
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
    staleTime: 60 * 1000,
    placeholderData: (previousData) => previousData,
  });

  const { data: journeyTrips } = useJourneyTrips(
    trip?.patient_id,
    trip?.pickup_time,
    activeTimezone,
  );

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
    staleTime: 5 * 60 * 1000,
    placeholderData: (previousData) => previousData,
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

  const updateWaitTimeMutation = useMutation({
    mutationFn: async ({
      tripId,
      minutes,
    }: {
      tripId: string;
      minutes: number;
    }) => {
      const { error } = await supabase
        .from("trips")
        .update({
          total_waiting_minutes: minutes,
        })
        .eq("id", tripId);

      if (error) throw error;

      await supabase.from("trip_status_history").insert({
        trip_id: tripId,
        status: `UPDATED: Wait Time ${minutes} minutes`,
        actor_id: user?.id,
        actor_name: profile?.full_name || user?.email || "System",
      });
    },
    onSuccess: () => {
      setEditingWaitTimeTrip(null);
      queryClient.invalidateQueries({ queryKey: ["trip", tripId] });
      queryClient.invalidateQueries({ queryKey: ["trips"] });
      queryClient.invalidateQueries({ queryKey: ["trip-history", tripId] });
      queryClient.invalidateQueries({
        queryKey: ["patient-daily-trips", trip?.patient_id],
      });
      queryClient.invalidateQueries({ queryKey: ["journey-trips"] });
      queryClient.invalidateQueries({ queryKey: ["trips-credits"] });
      queryClient.invalidateQueries({ queryKey: ["patients-credits"] });
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
            const meters = data.routes[0].legs[0].distance.value;
            actualDistance = Math.ceil(meters / 1609.34);
            const seconds = data.routes[0].legs[0].duration.value;
            actualDuration = Math.round(seconds / 60);
          }
        }
      } catch (err) {
        console.error("Error calculating actual distance:", err);
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

  const confirmStatusUpdate = (data: { reason?: string; explanation?: string }) => {
    if (!statusToUpdate) return;

    updateStatusMutation.mutate({
      status: statusToUpdate,
      cancelReason: data.reason,
      cancelExplanation: data.explanation,
    });

    setStatusToUpdate(null);
  };

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
        <div className="lg:col-span-2 space-y-8">
          <TripInfoCard 
            trip={trip}
            canManage={canManage}
            canDeleteTrips={canDeleteTrips}
            onEdit={onEdit}
            onDeleteRequest={() => setIsDeleteDialogOpen(true)}
            activeTimezone={activeTimezone}
          />

          <TripStatusActions 
            trip={trip}
            isDesignatedDriver={isDesignatedDriver}
            canManage={canManage}
            handleStatusUpdate={handleStatusUpdate}
            setShowSignatureDialog={setShowSignatureDialog}
            isGeneratingPDF={isGeneratingPDF}
            setIsGeneratingPDF={setIsGeneratingPDF}
            journeyTrips={journeyTrips}
            history={history}
            orgName={org?.name}
            activeTimezone={activeTimezone}
          />
        </div>

        <div className="flex flex-col gap-6">
          <TripMetrics 
            trip={trip}
            canManage={canManage}
            onEditMileage={handleEditMileage}
            onEditWaitTime={handleEditWaitTime}
          />

          {trip.patient_id && (
            <JourneyTimeline
              currentTripId={trip.id}
              patientId={trip.patient_id}
              pickupTime={trip.pickup_time}
              timezone={activeTimezone}
              canManage={canManage}
              onNavigate={handleNavigate}
              onEditMileage={handleEditMileage}
              onEditWaitTime={handleEditWaitTime}
            />
          )}

          <PatientProfileCard trip={trip} />

          <DriverProfileCard 
            trip={trip} 
            canManage={canManage} 
            onAssignDriver={() => onEdit?.(tripId)} 
          />

          <TripActivityTimeline 
            trip={trip}
            history={history}
            activeTimezone={activeTimezone}
          />

          {trip.status === "completed" &&
            (trip.signature_data || trip.signature_declined) && (
              <SignatureDisplay
                signatureData={trip.signature_data}
                signedByName={trip.signed_by_name}
                capturedAt={trip.signature_captured_at}
                declined={trip.signature_declined}
                declinedReason={trip.signature_declined_reason}
                timezone={activeTimezone}
              />
            )}
        </div>
      </div>

      {/* Dialogs */}
      <DeleteConfirmationDialog 
        isOpen={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        trip={trip}
        onConfirm={() => deleteTripMutation.mutate()}
      />

      <StatusUpdateDialog 
        statusToUpdate={statusToUpdate}
        onClose={() => setStatusToUpdate(null)}
        onConfirm={confirmStatusUpdate}
      />

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
          timezone={activeTimezone}
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

      <EditWaitTimeDialog
        isOpen={!!editingWaitTimeTrip}
        onOpenChange={(open) => !open && setEditingWaitTimeTrip(null)}
        trip={editingWaitTimeTrip}
        onConfirm={(minutes) => {
          if (editingWaitTimeTrip) {
            updateWaitTimeMutation.mutate({
              tripId: editingWaitTimeTrip.id,
              minutes,
            });
          }
        }}
      />
    </div>
  );
}
