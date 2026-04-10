import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient, keepPreviousData, type QueryState } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/auth-context";
import { usePermissions } from "@/hooks/usePermissions";
import { useTimezone } from "@/hooks/useTimezone";
import type { Trip, TripStatus, TripStatusHistory } from "../../types";

export function useTripDetails({
  tripId,
  onDeleteSuccess,
}: {
  tripId: string;
  onDeleteSuccess?: () => void;
}) {
  const { user, profile: authProfile } = useAuth();
  const { canManageTrips, canDeleteTrips } = usePermissions();
  const queryClient = useQueryClient();
  const activeTimezone = useTimezone();

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [statusToUpdate, setStatusToUpdate] = useState<TripStatus | null>(null);
  const [showSignatureDialog, setShowSignatureDialog] = useState(false);
  const [editingMileageTrip, setEditingMileageTrip] = useState<Trip | null>(null);
  const [editingWaitTimeTrip, setEditingWaitTimeTrip] = useState<Trip | null>(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  // Seed the individual trip query from any cached list query that already
  // contains this trip — gives instant data on navigation, no loading flash.
  const getSeedFromCache = useCallback((): Trip | undefined => {
    // Walk every cached query whose key starts with "trips" (list queries)
    const allQueries = queryClient.getQueriesData<Trip[]>({ queryKey: ["trips"] });
    for (const [, trips] of allQueries) {
      if (!trips) continue;
      const match = trips.find((t) => t.id === tripId);
      if (match) return match as Trip;
    }
    return undefined;
  }, [queryClient, tripId]);

  const getSeededAt = useCallback((): number => {
    const queries = queryClient.getQueriesData<Trip[]>({ queryKey: ["trips"] });
    let latest = 0;
    for (const [key] of queries) {
      const state = queryClient.getQueryState(key) as QueryState<Trip[]> | undefined;
      if (state?.dataUpdatedAt && state.dataUpdatedAt > latest) {
        latest = state.dataUpdatedAt;
      }
    }
    return latest;
  }, [queryClient, tripId]);

  // Queries
  const { data: trip, isLoading } = useQuery({
    queryKey: ["trip", tripId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trips")
        .select(`
            *,
            patient:patients(id, full_name, phone, email, created_at, user_id),
            driver:drivers(id, full_name, phone, email, user_id, vehicle_info)
        `)
        .eq("id", tripId)
        .single();
      if (error) throw error;
      return data as Trip;
    },
    staleTime: 60 * 1000,
    placeholderData: keepPreviousData,
    // Seed from list cache so the UI renders instantly on first navigation.
    // initialData is considered valid only as long as the list cache is fresh
    // (controlled by initialDataUpdatedAt + staleTime above).
    initialData: getSeedFromCache,
    initialDataUpdatedAt: getSeededAt,
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
    placeholderData: keepPreviousData,
  });

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
    placeholderData: keepPreviousData,
  });

  // Mutations
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

      const { error } = await supabase.from("trips").update(updates).eq("id", tripId);
      if (error) throw error;

      await supabase.from("trip_status_history").insert({
        trip_id: tripId,
        status: status,
        actor_id: user?.id,
        actor_name: authProfile?.full_name || user?.email || "System",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trip", tripId] });
      queryClient.invalidateQueries({ queryKey: ["trips"] });
      queryClient.invalidateQueries({ queryKey: ["trip-history", tripId] });
    },
  });

  const updateMileageMutation = useMutation({
    mutationFn: async ({ tripId, miles }: { tripId: string; miles: number }) => {
      const { error } = await supabase
        .from("trips")
        .update({ actual_distance_miles: miles })
        .eq("id", tripId);
      if (error) throw error;

      await supabase.from("trip_status_history").insert({
        trip_id: tripId,
        status: `UPDATED: Distance ${miles} miles`,
        actor_id: user?.id,
        actor_name: authProfile?.full_name || user?.email || "System",
      });
    },
    onSuccess: () => {
      setEditingMileageTrip(null);
      queryClient.invalidateQueries({ queryKey: ["trip", tripId] });
      queryClient.invalidateQueries({ queryKey: ["trips"] });
      queryClient.invalidateQueries({ queryKey: ["trip-history", tripId] });
    },
  });

  const updateWaitTimeMutation = useMutation({
    mutationFn: async ({ tripId, minutes }: { tripId: string; minutes: number }) => {
      const { error } = await supabase
        .from("trips")
        .update({ total_waiting_minutes: minutes })
        .eq("id", tripId);
      if (error) throw error;

      await supabase.from("trip_status_history").insert({
        trip_id: tripId,
        status: `UPDATED: Wait Time ${minutes} minutes`,
        actor_id: user?.id,
        actor_name: authProfile?.full_name || user?.email || "System",
      });
    },
    onSuccess: () => {
      setEditingWaitTimeTrip(null);
      queryClient.invalidateQueries({ queryKey: ["trip", tripId] });
      queryClient.invalidateQueries({ queryKey: ["trips"] });
      queryClient.invalidateQueries({ queryKey: ["trip-history", tripId] });
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
            trip.pickup_location
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

      const { error } = await supabase.from("trips").update(updates).eq("id", tripId);
      if (error) throw error;

      await supabase.from("trip_status_history").insert({
        trip_id: tripId,
        status: declined ? "COMPLETED (Signature Declined)" : "COMPLETED WITH SIGNATURE",
        actor_id: user?.id,
        actor_name: authProfile?.full_name || user?.email || "Driver",
      });
    },
    onSuccess: () => {
      setShowSignatureDialog(false);
      queryClient.invalidateQueries({ queryKey: ["trip", tripId] });
      queryClient.invalidateQueries({ queryKey: ["trips"] });
      queryClient.invalidateQueries({ queryKey: ["trip-history", tripId] });
    },
  });

  const handleStatusUpdate = useCallback((status: TripStatus) => {
    if (status === "cancelled" || status === "no_show") {
      setStatusToUpdate(status);
    } else {
      updateStatusMutation.mutate({ status });
    }
  }, [updateStatusMutation]);

  const confirmStatusUpdate = useCallback((data: { reason?: string; explanation?: string }) => {
    if (!statusToUpdate) return;
    updateStatusMutation.mutate({
      status: statusToUpdate,
      cancelReason: data.reason,
      cancelExplanation: data.explanation,
    });
    setStatusToUpdate(null);
  }, [statusToUpdate, updateStatusMutation]);

  const handleEditMileage = useCallback((t: Trip) => setEditingMileageTrip(t), []);
  const handleEditWaitTime = useCallback((t: Trip) => setEditingWaitTimeTrip(t), []);

  return {
    state: {
      trip,
      history,
      org,
      isLoading,
      isDeleteDialogOpen,
      statusToUpdate,
      showSignatureDialog,
      editingMileageTrip,
      editingWaitTimeTrip,
      isGeneratingPDF,
      activeTimezone,
      canManage: canManageTrips,
      canDeleteTrips,
      isDesignatedDriver: trip?.driver?.user_id === user?.id,
    },
    actions: {
      setIsDeleteDialogOpen,
      setStatusToUpdate,
      setShowSignatureDialog,
      setEditingMileageTrip,
      setEditingWaitTimeTrip,
      setIsGeneratingPDF,
      handleStatusUpdate,
      confirmStatusUpdate,
      handleEditMileage,
      handleEditWaitTime,
      deleteTrip: () => deleteTripMutation.mutate(),
      captureSignature: signatureCaptureMutation.mutate,
      isCapturingSignature: signatureCaptureMutation.isPending,
      updateMileage: (tripId: string, miles: number) => updateMileageMutation.mutate({ tripId, miles }),
      updateWaitTime: (tripId: string, minutes: number) => updateWaitTimeMutation.mutate({ tripId, minutes }),
    },
  };
}
