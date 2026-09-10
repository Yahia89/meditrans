import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient, type QueryState } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/auth-context";
import { usePermissions } from "@/hooks/usePermissions";
import { useTimezone } from "@/hooks/useTimezone";
import type { Trip, TripStatus, TripStatusHistory } from "../../types";
import { toast } from "sonner";
import {
  normalizeBrowserEventLocation,
  type BrowserEventLocation,
} from "../browserEventLocation";

function captureBrowserEventLocation(): Promise<BrowserEventLocation> {
  if (!navigator.geolocation) {
    return Promise.reject(
      new Error("This browser cannot provide the event-time location."),
    );
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        try {
          resolve(
            normalizeBrowserEventLocation({
              latitude,
              longitude,
              accuracyMeters: accuracy,
              capturedAtMs: Number(position.timestamp),
            }),
          );
        } catch (error) {
          reject(
            error instanceof Error
              ? error
              : new Error("The browser returned invalid location evidence."),
          );
        }
      },
      () => {
        reject(
          new Error(
            "A current location is required. Allow location access and try again.",
          ),
        );
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 15_000,
      },
    );
  });
}

function createClientEventId() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const value = Math.floor(Math.random() * 16);
    return (char === "x" ? value : (value & 0x3) | 0x8).toString(16);
  });
}

function isRetryableTransportError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: unknown; message?: unknown };
  if (typeof candidate.code === "string" && candidate.code.length > 0) {
    return false;
  }
  return (
    typeof candidate.message === "string" &&
    /fetch|network|timeout|connection|socket/i.test(candidate.message)
  );
}

async function applyTripTransitionWithRetry(
  params: Record<string, string | number | boolean | null>,
) {
  let result = await supabase.rpc("apply_trip_transition", params);
  if (result.error && isRetryableTransportError(result.error)) {
    // Preserve the event id and full payload. If the first response was lost
    // after commit, the RPC returns the already-created history event.
    result = await supabase.rpc("apply_trip_transition", params);
  }
  if (result.error) throw result.error;
  return result.data;
}

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
  }, [queryClient]);

  // Queries
  const { data: trip, isLoading, refetch: refetchTrip } = useQuery({
    queryKey: ["trip", tripId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trips")
        .select(`
            *,
            patient:patients(id, full_name, phone, email, created_at, user_id),
            driver:drivers(id, full_name, phone, email, user_id, id_number, license_number, vehicle_info, vehicle_type, vehicle_make, vehicle_model, license_plate, current_lat, current_lng)
        `)
        .eq("id", tripId)
        .single();
      if (error) throw error;
      return data as Trip;
    },
    staleTime: 0,
    // Seed from list cache so the UI renders instantly on first navigation.
    // initialData is considered valid only as long as the list cache is fresh
    // (controlled by initialDataUpdatedAt + staleTime above).
    initialData: getSeedFromCache,
    initialDataUpdatedAt: getSeededAt,
  });

  const {
    data: history,
    isLoading: isHistoryLoading,
    refetch: refetchHistory,
  } = useQuery({
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
  });

  const { data: cancellationAudit, refetch: refetchCancellationAudit } = useQuery({
    queryKey: ["trip-cancellation-audit", tripId],
    queryFn: async () => {
      if (!tripId || !["cancelled", "no_show"].includes(trip?.status || "")) return null;
      const { data, error } = await supabase
        .from("trip_cancellation_audits")
        .select("*")
        .eq("trip_id", tripId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!tripId && ["cancelled", "no_show"].includes(trip?.status || ""),
    staleTime: 5 * 60 * 1000,
  });

  const { data: org, refetch: refetchOrganization } = useQuery({
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
      if (!trip) throw new Error("Trip data is not loaded yet.");
      const isPhysicalMilestone = !["cancelled", "no_show"].includes(status);
      if (isPhysicalMilestone) {
        if (trip.driver?.user_id !== user?.id) {
          throw new Error(
            "Driver milestones must be recorded by the assigned driver so event-time GPS can be verified.",
          );
        }

        const location = await captureBrowserEventLocation();
        await applyTripTransitionWithRetry({
          p_org_id: trip.org_id,
          p_trip_id: tripId,
          p_expected_status: trip.status,
          p_new_status: status,
          p_client_event_id: createClientEventId(),
          p_trigger_kind: "manual",
          p_source_surface: "web_crm",
          p_client_platform: "web",
          p_latitude: location.latitude,
          p_longitude: location.longitude,
          p_location_source: "browser_geolocation",
          p_location_captured_at: location.capturedAt,
          p_location_accuracy_m: location.accuracyMeters,
          p_signature_data: null,
          p_signed_by_name: null,
          p_signature_declined: null,
          p_signature_declined_reason: null,
        });

        if (status === "en_route") {
          void supabase.functions.invoke("send_eta_sms", {
            body: { trip_id: tripId, source: "web-status-update" },
          });
        }
        return;
      }

      await applyTripTransitionWithRetry({
        p_org_id: trip.org_id,
        p_trip_id: tripId,
        p_expected_status: trip.status,
        p_new_status: status,
        p_client_event_id: createClientEventId(),
        p_trigger_kind: "manual",
        p_source_surface: "web_crm",
        p_client_platform: "web",
        // A CRM exception action has no event-time driver fix. Do not present
        // a potentially stale last-known point as audit evidence.
        p_latitude: null,
        p_longitude: null,
        p_location_source: null,
        p_location_captured_at: null,
        p_location_accuracy_m: null,
        p_signature_data: null,
        p_signed_by_name: null,
        p_signature_declined: null,
        p_signature_declined_reason: null,
        p_cancel_reason: cancelReason ?? null,
        p_cancel_explanation: cancelExplanation ?? null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trip", tripId] });
      queryClient.invalidateQueries({ queryKey: ["trips"] });
      queryClient.invalidateQueries({ queryKey: ["trip-history", tripId] });
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Unable to update trip status",
      );
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
        trigger_kind: "manual",
        source_surface: "web_crm",
        client_platform: "web",
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
        trigger_kind: "manual",
        source_surface: "web_crm",
        client_platform: "web",
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
      if (!trip || trip.driver?.user_id !== user?.id) {
        throw new Error(
          "Trip completion must be recorded by the assigned driver so event-time GPS can be verified.",
        );
      }

      const location = await captureBrowserEventLocation();
      await applyTripTransitionWithRetry({
        p_org_id: trip.org_id,
        p_trip_id: tripId,
        p_expected_status: trip.status,
        p_new_status: "completed",
        p_client_event_id: createClientEventId(),
        p_trigger_kind: "manual",
        p_source_surface: "web_crm",
        p_client_platform: "web",
        p_latitude: location.latitude,
        p_longitude: location.longitude,
        p_location_source: "browser_geolocation",
        p_location_captured_at: location.capturedAt,
        p_location_accuracy_m: location.accuracyMeters,
        p_signature_data: declined ? null : (signatureData ?? null),
        p_signed_by_name: declined ? null : (signedByName ?? null),
        p_signature_declined: Boolean(declined),
        p_signature_declined_reason: declined ? (declinedReason ?? null) : null,
      });
    },
    onSuccess: () => {
      setShowSignatureDialog(false);
      queryClient.invalidateQueries({ queryKey: ["trip", tripId] });
      queryClient.invalidateQueries({ queryKey: ["trips"] });
      queryClient.invalidateQueries({ queryKey: ["trip-history", tripId] });
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : "Unable to complete trip",
      );
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

  const refreshPdfData = useCallback(async () => {
    const [tripResult, historyResult, cancellationResult, organizationResult] =
      await Promise.all([
        refetchTrip(),
        refetchHistory(),
        refetchCancellationAudit(),
        refetchOrganization(),
      ]);

    if (tripResult.error) throw tripResult.error;
    if (historyResult.error) throw historyResult.error;
    if (cancellationResult.error) throw cancellationResult.error;
    if (organizationResult.error) throw organizationResult.error;
    if (!tripResult.data || tripResult.data.id !== tripId) {
      throw new Error("Fresh trip data did not match the selected trip.");
    }

    return {
      trip: tripResult.data as Trip,
      history: (historyResult.data || []) as TripStatusHistory[],
      cancellationAudit: cancellationResult.data || null,
      orgName: organizationResult.data?.name,
    };
  }, [
    refetchCancellationAudit,
    refetchHistory,
    refetchOrganization,
    refetchTrip,
    tripId,
  ]);

  return {
    state: {
      trip,
      history,
      org,
      cancellationAudit,
      isLoading,
      isHistoryLoading,
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
      refreshPdfData,
    },
  };
}
