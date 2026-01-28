import { useEffect, useRef, useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useOrganization } from "@/contexts/OrganizationContext";
import { interpolateLatLng, calculateBearing } from "@/lib/geo";
import type { LiveDriver, LiveTrip } from "./types";

// Configuration constants
const ANIMATION_FPS = 4; // 4 updates per second instead of 60
const ANIMATION_INTERVAL = 1000 / ANIMATION_FPS;
const INTERPOLATION_FACTOR = 0.25; // Slightly higher since we update less frequently
const STOP_THRESHOLD_SQ = 0.000000001; // Stop animating when squared distance is below this
const DELTA_THRESH_SQ = 0.0000001; // Ignore Supabase updates smaller than this (~10m)

// Approximate squared distance (faster than calculating actual distance)
function approxSqDist(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const dLat = a.lat - b.lat;
  const dLng = a.lng - b.lng;
  return dLat * dLat + dLng * dLng;
}

// Interface for mutable position tracking
interface PositionState {
  lat: number;
  lng: number;
  target: { lat: number; lng: number };
  bearing: number;
}

export function useLiveTracking() {
  const { currentOrganization } = useOrganization();
  const queryClient = useQueryClient();
  const [drivers, setDrivers] = useState<LiveDriver[]>([]);

  // Mutable position state - avoids React re-renders on every interpolation step
  const positionsRef = useRef<Map<string, PositionState>>(new Map());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 1. Fetch Drivers using TanStack Query
  const { data: driversData, isLoading: driversLoading } = useQuery({
    queryKey: ["live-drivers", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      const { data, error } = await supabase
        .from("drivers")
        .select(
          "id, full_name, current_lat, current_lng, last_location_update, active",
        )
        .eq("org_id", currentOrganization.id);

      if (error) throw error;
      return data || [];
    },
    enabled: !!currentOrganization?.id,
    staleTime: 1000 * 60 * 5, // 5 minutes (we rely on Realtime for position updates)
  });

  // 2. Fetch Active Trips using TanStack Query
  const { data: tripsData, isLoading: tripsLoading } = useQuery({
    queryKey: ["live-trips", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      const { data, error } = await supabase
        .from("trips")
        .select(
          `
          id, 
          status, 
          driver_id, 
          pickup_location, 
          dropoff_location, 
          pickup_time,
          patient:patients(full_name),
          driver:drivers(full_name)
        `,
        )
        .eq("org_id", currentOrganization.id)
        .in("status", ["en_route", "in_progress"]);

      if (error) throw error;

      return (data || []).map((t: any) => ({
        id: t.id,
        status: t.status,
        driver_id: t.driver_id,
        pickup_location: t.pickup_location,
        dropoff_location: t.dropoff_location,
        pickup_time: t.pickup_time,
        patient: t.patient,
        driver: t.driver,
      })) as LiveTrip[];
    },
    enabled: !!currentOrganization?.id,
  });

  // Sync React state and Animation Ref when Query data changes
  useEffect(() => {
    if (!driversData) return;

    setDrivers((prev) => {
      return driversData.map((d) => {
        const activeTrip = tripsData?.find((t) => t.driver_id === d.id);
        let status: LiveDriver["status"] = "idle";
        if (!d.active) status = "offline";
        else if (activeTrip) status = "en_route";

        const lat = d.current_lat || 0;
        const lng = d.current_lng || 0;

        // Initialize or update mutable position ref
        if (!positionsRef.current.has(d.id)) {
          positionsRef.current.set(d.id, {
            lat,
            lng,
            target: { lat, lng },
            bearing: 0,
          });
        }

        // Try to keep the current animated position if it exists
        const existing = prev.find((p) => p.id === d.id);

        return {
          ...d,
          lat: existing?.lat ?? lat,
          lng: existing?.lng ?? lng,
          target: { lat, lng },
          bearing: existing?.bearing ?? 0,
          status,
          active_trip_id: activeTrip?.id,
        };
      });
    });
  }, [driversData, tripsData]);

  // Flush positions from ref to React state (batched update)
  const flushPositions = useCallback(() => {
    const positions = positionsRef.current;
    if (positions.size === 0) return;

    setDrivers((prev) => {
      let hasChanges = false;
      const updated = prev.map((d) => {
        const pos = positions.get(d.id);
        if (!pos) return d;

        // Check if position actually changed
        if (
          d.lat !== pos.lat ||
          d.lng !== pos.lng ||
          d.bearing !== pos.bearing
        ) {
          hasChanges = true;
          return {
            ...d,
            lat: pos.lat,
            lng: pos.lng,
            target: pos.target,
            bearing: pos.bearing,
          };
        }
        return d;
      });

      return hasChanges ? updated : prev;
    });
  }, []);

  // Animation loop using setInterval (throttled to ANIMATION_FPS)
  useEffect(() => {
    function tick() {
      const positions = positionsRef.current;

      positions.forEach((pos, id) => {
        // Skip if no target or already at target
        const distSq = approxSqDist(pos, pos.target);
        if (distSq < STOP_THRESHOLD_SQ) return;

        // Interpolate towards target
        const next = interpolateLatLng(pos, pos.target, INTERPOLATION_FACTOR);
        const newBearing = calculateBearing(pos, pos.target);

        // Update mutable ref (no React re-render)
        positions.set(id, {
          ...pos,
          lat: next.lat,
          lng: next.lng,
          bearing: newBearing,
        });
      });

      // Batch flush to React state
      flushPositions();
    }

    intervalRef.current = setInterval(tick, ANIMATION_INTERVAL);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [flushPositions]);

  // Realtime Subscriptions
  useEffect(() => {
    if (!currentOrganization?.id) return;

    const channel = supabase
      .channel("drivers-live")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "drivers",
          filter: `org_id=eq.${currentOrganization.id}`,
        },
        (payload) => {
          const driverId = payload.new.id;
          const newLat = payload.new.current_lat;
          const newLng = payload.new.current_lng;

          // Update the animation target immediately in our local ref
          const existingPos = positionsRef.current.get(driverId);
          if (existingPos && newLat != null && newLng != null) {
            const delta = approxSqDist(existingPos.target, {
              lat: newLat,
              lng: newLng,
            });

            // Update target if movement is significant
            if (delta > DELTA_THRESH_SQ) {
              positionsRef.current.set(driverId, {
                ...existingPos,
                target: { lat: newLat, lng: newLng },
              });
            }
          }

          // Update React state for metadata (active status, timestamps)
          setDrivers((prev) =>
            prev.map((d) =>
              d.id === driverId
                ? {
                    ...d,
                    target: { lat: newLat, lng: newLng },
                    last_location_update: payload.new.last_location_update,
                    active: payload.new.active,
                  }
                : d,
            ),
          );
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "trips",
          filter: `org_id=eq.${currentOrganization.id}`,
        },
        () => {
          // Keep it simple: invalidate trips to trigger a refetch
          queryClient.invalidateQueries({
            queryKey: ["live-trips", currentOrganization.id],
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentOrganization?.id, queryClient]);

  return {
    drivers,
    trips: tripsData || [],
    loading: driversLoading || (tripsLoading && drivers.length === 0),
  };
}
