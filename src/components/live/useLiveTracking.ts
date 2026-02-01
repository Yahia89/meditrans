import { useOrganization } from "@/contexts/OrganizationContext";
import { calculateBearing, interpolateLatLng } from "@/lib/geo";
import { supabase } from "@/lib/supabase";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import type { LiveDriver, LiveTrip } from "./types";

// Configuration constants
// 60 FPS animation for smooth "Uber-like" movement
const LERP_FACTOR = 0.08; // Adjust for smoothness (0.05 = slow glide, 0.2 = snappy)
const STOP_THRESHOLD_SQ = 0.000000001; // Stop interpolating when very close
const BEARING_UPDATE_THRESHOLD_SQ = 0.0000005; // Only update bearing if moved ~2-3 meters
const BROADCAST_CHANNEL = "drivers-live";

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
  lastUpdated: number;
}

export function useLiveTracking() {
  const { currentOrganization } = useOrganization();
  const queryClient = useQueryClient();
  const [drivers, setDrivers] = useState<LiveDriver[]>([]);

  // Mutable position state - avoids React re-renders on every interpolation step
  const positionsRef = useRef<Map<string, PositionState>>(new Map());
  const rafRef = useRef<number | null>(null);

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

    setDrivers((_) => {
      return driversData.map((d) => {
        const activeTrip = tripsData?.find((t) => t.driver_id === d.id);
        let status: LiveDriver["status"] = "idle";
        if (!d.active) status = "offline";
        else if (activeTrip) status = "en_route";

        const lat = d.current_lat || 0;
        const lng = d.current_lng || 0;

        // Initialize mutable position ref if missing
        if (!positionsRef.current.has(d.id)) {
          positionsRef.current.set(d.id, {
            lat,
            lng,
            target: { lat, lng },
            bearing: 0,
            lastUpdated: Date.now(),
          });
        }

        const existingRef = positionsRef.current.get(d.id);

        return {
          ...d,
          lat: existingRef?.lat ?? lat,
          lng: existingRef?.lng ?? lng,
          target: existingRef?.target ?? { lat, lng },
          bearing: existingRef?.bearing ?? 0,
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

        // Don't result in new object reference if values are identical (React optimization)
        if (
          Math.abs(d.lat - pos.lat) < Number.EPSILON &&
          Math.abs(d.lng - pos.lng) < Number.EPSILON &&
          Math.abs((d.bearing || 0) - pos.bearing) < Number.EPSILON
        ) {
          return d;
        }

        hasChanges = true;
        return {
          ...d,
          lat: pos.lat,
          lng: pos.lng,
          target: pos.target,
          bearing: pos.bearing,
        };
      });

      return hasChanges ? updated : prev;
    });
  }, []);

  // Animation Loop (60 FPS)
  useEffect(() => {
    const tick = () => {
      const positions = positionsRef.current;
      let needsFlush = false;

      positions.forEach((pos, id) => {
        const distSq = approxSqDist(pos, pos.target);

        // If very close to target, snap to it to stop micro-calculations
        if (distSq < STOP_THRESHOLD_SQ) {
          if (pos.lat !== pos.target.lat || pos.lng !== pos.target.lng) {
            pos.lat = pos.target.lat;
            pos.lng = pos.target.lng;
            needsFlush = true;
          }
          return;
        }

        // Interpolate (Lerp)
        const next = interpolateLatLng(pos, pos.target, LERP_FACTOR);

        // Calculate Bearing only if we moved enough
        // This prevents the "spin to 0" issue when stopped
        let newBearing = pos.bearing;
        if (distSq > BEARING_UPDATE_THRESHOLD_SQ) {
          newBearing = calculateBearing(pos, pos.target);
        }

        // Update mutable ref
        positions.set(id, {
          ...pos,
          lat: next.lat,
          lng: next.lng,
          bearing: newBearing,
        });

        needsFlush = true;
      });

      if (needsFlush) {
        flushPositions();
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [flushPositions]);

  // Handle Incoming Position Updates (Common logic for DB and Broadcast)
  const handlePositionUpdate = useCallback(
    (driverId: string, newLat: number, newLng: number, newHeading?: number) => {
      const positions = positionsRef.current;
      const existing = positions.get(driverId);

      if (existing) {
        // Only update target if it's different/new
        const dist = approxSqDist(existing.target, {
          lat: newLat,
          lng: newLng,
        });
        if (dist > STOP_THRESHOLD_SQ) {
          positions.set(driverId, {
            ...existing,
            target: { lat: newLat, lng: newLng },
            lastUpdated: Date.now(),
          });
        }
      } else {
        // New Driver found via Stream
        positions.set(driverId, {
          lat: newLat,
          lng: newLng,
          target: { lat: newLat, lng: newLng },
          bearing: newHeading || 0,
          lastUpdated: Date.now(),
        });
      }
    },
    [],
  ); // dependencies empty as refs are stable

  // Realtime Subscriptions (Broadcast + DB Backup)
  useEffect(() => {
    if (!currentOrganization?.id) return;

    // 1. Broadcast Channel (Low Latency)
    const broadcastChannel = supabase
      .channel(BROADCAST_CHANNEL)
      .on("broadcast", { event: "location-update" }, (payload) => {
        // Expecting payload: { id, lat, lng, heading?, timestamp? }
        // Payload shape depends on how it's sent. Usually payload.payload or directly payload if destructured.
        // Supabase 'broadcast' event handler receives object { payload: ..., event: ..., type: ... }
        const p = payload.payload;
        if (p && p.id && p.lat && p.lng) {
          handlePositionUpdate(p.id, p.lat, p.lng, p.heading);
        }
      })
      .subscribe();

    // 2. Database Changes (Backup / Reliability)
    const dbChannel = supabase
      .channel("drivers-db-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "drivers",
          filter: `org_id=eq.${currentOrganization.id}`,
        },
        (payload) => {
          if (payload.eventType === "UPDATE") {
            const newLat = payload.new.current_lat;
            const newLng = payload.new.current_lng;
            if (newLat != null && newLng != null) {
              handlePositionUpdate(payload.new.id, newLat, newLng);
            }

            // Also update active metadata
            setDrivers((prev) => {
              const idx = prev.findIndex((d) => d.id === payload.new.id);
              if (idx === -1) return prev;
              const updated = [...prev];
              updated[idx] = {
                ...updated[idx],
                active: payload.new.active,
                last_location_update: payload.new.last_location_update,
              };
              return updated;
            });
          } else if (
            payload.eventType === "INSERT" ||
            payload.eventType === "DELETE"
          ) {
            queryClient.invalidateQueries({
              queryKey: ["live-drivers", currentOrganization.id],
            });
          }
        },
      )
      .subscribe();

    // 3. Trip Changes
    const tripsChannel = supabase
      .channel("trips-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "trips",
          filter: `org_id=eq.${currentOrganization.id}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: ["live-trips", currentOrganization.id],
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(broadcastChannel);
      supabase.removeChannel(dbChannel);
      supabase.removeChannel(tripsChannel);
    };
  }, [currentOrganization?.id, queryClient, handlePositionUpdate]);

  return {
    drivers,
    trips: tripsData || [],
    loading: driversLoading || (tripsLoading && drivers.length === 0),
  };
}
