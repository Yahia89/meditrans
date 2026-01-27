import { useEffect, useRef, useState, useCallback } from "react";
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
  const [drivers, setDrivers] = useState<LiveDriver[]>([]);
  const [trips, setTrips] = useState<LiveTrip[]>([]);
  const [loading, setLoading] = useState(true);

  // Mutable position state - avoids React re-renders on every interpolation step
  const positionsRef = useRef<Map<string, PositionState>>(new Map());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  // Initial fetch
  useEffect(() => {
    if (!currentOrganization?.id) return;

    (async () => {
      try {
        const { data: driversData } = await supabase
          .from("drivers")
          .select(
            "id, full_name, current_lat, current_lng, last_location_update, active",
          )
          .eq("org_id", currentOrganization.id);

        const { data: tripsData } = await supabase
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

        const formattedTrips: LiveTrip[] = (tripsData || []).map((t: any) => ({
          id: t.id,
          status: t.status,
          driver_id: t.driver_id,
          pickup_location: t.pickup_location,
          dropoff_location: t.dropoff_location,
          pickup_time: t.pickup_time,
          patient: t.patient,
          driver: t.driver,
        }));

        // Initialize drivers and positionsRef together
        const initialDrivers = (driversData || []).map((d) => {
          const activeTrip = formattedTrips.find((t) => t.driver_id === d.id);
          let status: LiveDriver["status"] = "idle";
          if (!d.active) status = "offline";
          else if (activeTrip) status = "en_route";

          const lat = d.current_lat || 0;
          const lng = d.current_lng || 0;

          // Initialize position in mutable ref
          positionsRef.current.set(d.id, {
            lat,
            lng,
            target: { lat, lng },
            bearing: 0,
          });

          return {
            ...d,
            lat,
            lng,
            target: { lat, lng },
            bearing: 0,
            status,
            active_trip_id: activeTrip?.id,
          };
        });

        setDrivers(initialDrivers);

        setTrips(formattedTrips);
      } catch (err) {
        console.error("Error fetching live tracking data:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [currentOrganization?.id]);

  // Realtime
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

          // Check if this is a significant position change
          const existingPos = positionsRef.current.get(driverId);
          if (existingPos && newLat != null && newLng != null) {
            const delta = approxSqDist(existingPos.target, {
              lat: newLat,
              lng: newLng,
            });

            // Ignore tiny movements (reduces state churn)
            if (delta < DELTA_THRESH_SQ) {
              // Still update non-position fields
              setDrivers((prev) =>
                prev.map((d) =>
                  d.id === driverId
                    ? {
                        ...d,
                        last_location_update: payload.new.last_location_update,
                        active: payload.new.active,
                      }
                    : d,
                ),
              );
              return;
            }

            // Update target in mutable ref (animation loop will interpolate)
            positionsRef.current.set(driverId, {
              ...existingPos,
              target: { lat: newLat, lng: newLng },
            });
          }

          // Update React state for metadata and new target
          setDrivers((prev) =>
            prev.map((d) =>
              d.id === driverId
                ? {
                    ...d,
                    target: { lat: newLat, lng: newLng },
                    current_lat: newLat,
                    current_lng: newLng,
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
          // Keep it simple and just refetch trips when they change
          // (In a very high traffic app you'd want to be more surgical)
          supabase
            .from("trips")
            .select(
              `
              id, status, driver_id, pickup_location, dropoff_location, pickup_time,
              patient:patients(full_name), driver:drivers(full_name)
            `,
            )
            .eq("org_id", currentOrganization.id)
            .in("status", ["en_route", "in_progress"])
            .then(({ data }) => {
              if (data) {
                const formatted = data.map((t: any) => ({
                  id: t.id,
                  status: t.status,
                  driver_id: t.driver_id,
                  pickup_location: t.pickup_location,
                  dropoff_location: t.dropoff_location,
                  pickup_time: t.pickup_time,
                  patient: t.patient,
                  driver: t.driver,
                }));
                setTrips(formatted);
              }
            });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentOrganization?.id]);

  return { drivers, trips, loading };
}
