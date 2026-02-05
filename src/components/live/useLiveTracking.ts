import { useOrganization } from "@/contexts/OrganizationContext";
import {
  calculateBearing,
  interpolateLatLng,
  approxSqDist,
  findNearestPointOnPolyline,
  getPositionAtDistance,
  getDistanceAtSegment,
  decodePolyline,
  calculateCumulativeDistances,
  isOnRoute,
  lerpBearing,
  type PolylinePoint,
} from "@/lib/geo";
import { supabase } from "@/lib/supabase";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import type { LiveDriver, LiveTrip, DriverRouteFollowingState } from "./types";

// ============================================================================
// CONFIGURATION
// ============================================================================

// Animation settings (60 FPS, Uber-tier smoothness)
const LERP_FACTOR = 0.08; // Adjust for smoothness (0.05 = slow glide, 0.2 = snappy)
const STOP_THRESHOLD_SQ = 0.000000001; // Stop interpolating when very close
const BEARING_UPDATE_THRESHOLD_SQ = 0.0000005; // Only update bearing if moved ~2-3 meters

// Route deviation detection
const ROUTE_TOLERANCE_METERS = 50; // How far off-route before we care
const DEVIATION_THRESHOLD_MS = 20000; // 20 seconds off-route = needs reroute

// Broadcast channel
const BROADCAST_CHANNEL = "drivers-live";

// ============================================================================
// TYPES
// ============================================================================

/** Mutable position tracking (avoids React re-renders on every frame) */
interface PositionState {
  lat: number;
  lng: number;
  target: { lat: number; lng: number };
  bearing: number;
  lastUpdated: number;
}

/** Cached route data for a trip */
interface CachedRoute {
  polyline: PolylinePoint[];
  cumulativeDistances: number[];
  totalDistance: number;
  tripId: string;
  origin: string;
  destination: string;
  /** Encoded polyline string for cache comparison */
  encodedPolyline: string;
}

// ============================================================================
// HOOK
// ============================================================================

export function useLiveTracking() {
  const { currentOrganization } = useOrganization();
  const queryClient = useQueryClient();
  const [drivers, setDrivers] = useState<LiveDriver[]>([]);

  // Mutable position state - avoids React re-renders on every interpolation step
  const positionsRef = useRef<Map<string, PositionState>>(new Map());
  const rafRef = useRef<number | null>(null);

  // Route cache: tripId -> CachedRoute
  const routeCacheRef = useRef<Map<string, CachedRoute>>(new Map());

  // Route-following states: driverId -> state (mutable ref for performance)
  const routeFollowingRef = useRef<Map<string, DriverRouteFollowingState>>(
    new Map(),
  );

  // Reactive copy of route following states - triggers re-renders in consumers
  // We sync this with the ref when meaningful changes occur (segment, offRoute, path updates)
  const [routeFollowingStates, setRouteFollowingStates] = useState<
    Map<string, DriverRouteFollowingState>
  >(new Map());

  // ============================================================================
  // DATA FETCHING
  // ============================================================================

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

  // ============================================================================
  // ROUTE MANAGEMENT
  // ============================================================================

  /**
   * Set route for a trip from DirectionsResult
   * Call this when directions are fetched (from LiveMap)
   */
  const setRouteForTrip = useCallback(
    (
      tripId: string,
      directionsResult: google.maps.DirectionsResult,
      origin: string,
      destination: string,
    ) => {
      try {
        const route = directionsResult.routes[0];
        if (!route?.overview_polyline) {
          console.warn("[LiveTracking] No polyline in directions");
          return;
        }

        const encodedPolyline = route.overview_polyline;

        // Check if already cached with same polyline
        const existing = routeCacheRef.current.get(tripId);
        if (existing?.encodedPolyline === encodedPolyline) {
          return; // Same route, no need to re-decode
        }

        // Decode polyline (pure JS, no API cost)
        const polyline = decodePolyline(encodedPolyline);
        if (polyline.length < 2) {
          console.warn("[LiveTracking] Polyline too short");
          return;
        }

        // Calculate cumulative distances
        const cumulativeDistances = calculateCumulativeDistances(polyline);
        const totalDistance =
          cumulativeDistances[cumulativeDistances.length - 1];

        routeCacheRef.current.set(tripId, {
          polyline,
          cumulativeDistances,
          totalDistance,
          tripId,
          origin,
          destination,
          encodedPolyline,
        });

        console.log(
          `[LiveTracking] Route cached: ${tripId} (${polyline.length} pts, ${Math.round(totalDistance)}m)`,
        );
      } catch (err) {
        console.error("[LiveTracking] Error setting route:", err);
      }
    },
    [],
  );

  /**
   * Clear route cache for a trip
   */
  const clearRouteForTrip = useCallback((tripId: string) => {
    routeCacheRef.current.delete(tripId);
  }, []);

  /**
   * Get cached route for a trip
   */
  const getRouteForTrip = useCallback((tripId: string): CachedRoute | null => {
    return routeCacheRef.current.get(tripId) ?? null;
  }, []);

  // ============================================================================
  // STATE SYNC
  // ============================================================================

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

  // ============================================================================
  // POSITION UPDATES
  // ============================================================================

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

  // Handle Incoming Position Updates with Route-Aware Projection
  const handlePositionUpdate = useCallback(
    (driverId: string, newLat: number, newLng: number, newHeading?: number) => {
      const positions = positionsRef.current;
      const existing = positions.get(driverId);
      const now = Date.now();

      // Find active trip for this driver
      const activeTrip = tripsData?.find((t) => t.driver_id === driverId);
      const route = activeTrip
        ? routeCacheRef.current.get(activeTrip.id)
        : null;

      // Raw GPS point
      const rawPosition: PolylinePoint = { lat: newLat, lng: newLng };

      // Calculate projected position if we have a route
      let targetPosition = rawPosition;
      let projectedBearing = newHeading ?? existing?.bearing ?? 0;

      if (route && route.polyline.length >= 2) {
        // Project GPS onto polyline (road-accurate position)
        const projection = findNearestPointOnPolyline(
          rawPosition,
          route.polyline,
        );

        // Calculate distance along route
        const distanceAlongRoute = getDistanceAtSegment(
          route.cumulativeDistances,
          route.polyline,
          projection.segmentIndex,
          projection.t,
        );

        // Get position and bearing from route
        const routePosition = getPositionAtDistance(
          route.polyline,
          route.cumulativeDistances,
          distanceAlongRoute,
        );

        // Use projected position if driver is on route
        const onRoute = isOnRoute(
          rawPosition,
          route.polyline,
          ROUTE_TOLERANCE_METERS,
        );

        if (onRoute) {
          // Snap to route
          targetPosition = routePosition.position;
          projectedBearing = routePosition.bearing;
        } else {
          // Off-route: use raw GPS but with route bearing hint
          targetPosition = rawPosition;
          // Keep last bearing to prevent jitter
        }

        // Update route-following state
        const prevFollowingState = routeFollowingRef.current.get(driverId);
        const followingState = prevFollowingState || {
          distanceAlongRoute: 0,
          totalDistance: route.totalDistance,
          segmentIndex: 0,
          isOffRoute: false,
          offRouteStartTime: null,
          rerouteRequested: false,
          deviationTrail: [],
          completedDeviations: [],
          actualPathHistory: [],
        };

        // Track if meaningful changes occurred that require UI update
        const prevSegmentIndex = prevFollowingState?.segmentIndex ?? -1;
        const prevIsOffRoute = prevFollowingState?.isOffRoute ?? false;
        const prevPathLength =
          prevFollowingState?.actualPathHistory?.length ?? 0;

        // Always update total distance from cached route
        followingState.totalDistance = route.totalDistance;

        // Track complete GPS path for the driven portion (gray line)
        const pathHistory = followingState.actualPathHistory || [];
        // Only add point if it's different from the last point (avoid duplicates)
        const lastPoint = pathHistory[pathHistory.length - 1];
        if (
          !lastPoint ||
          Math.abs(lastPoint.lat - rawPosition.lat) > 0.00001 ||
          Math.abs(lastPoint.lng - rawPosition.lng) > 0.00001
        ) {
          // Limit to 2000 points to prevent memory issues
          if (pathHistory.length < 2000) {
            pathHistory.push({ ...rawPosition });
            followingState.actualPathHistory = pathHistory;
          }
        }

        if (!onRoute) {
          if (!followingState.offRouteStartTime) {
            followingState.offRouteStartTime = now;
            // Start new deviation trail
            followingState.deviationTrail = [rawPosition];
          } else {
            // Add to active deviation trail (limit to 500 points)
            const trail = followingState.deviationTrail || [];
            if (trail.length < 500) {
              trail.push(rawPosition);
              followingState.deviationTrail = trail;
            }

            if (
              now - followingState.offRouteStartTime > DEVIATION_THRESHOLD_MS &&
              !followingState.rerouteRequested
            ) {
              // Been off-route long enough - flag for reroute
              followingState.rerouteRequested = true;
              console.log(
                `[LiveTracking] Driver ${driverId} needs reroute (off-route ${Math.round((now - followingState.offRouteStartTime) / 1000)}s)`,
              );
              // The actual reroute is triggered by LiveMap when it sees needsReroute
            }
          }
        } else {
          // Back on route - archive current deviation if exists
          if (
            followingState.deviationTrail &&
            followingState.deviationTrail.length > 1
          ) {
            // Archive this completed deviation segment
            const completedDeviations =
              followingState.completedDeviations || [];
            completedDeviations.push([...followingState.deviationTrail]);
            followingState.completedDeviations = completedDeviations;
            console.log(
              `[LiveTracking] Driver ${driverId} returned to route, archived deviation (${followingState.deviationTrail.length} points)`,
            );
          }
          // Clear active deviation state
          followingState.offRouteStartTime = null;
          followingState.rerouteRequested = false;
          followingState.deviationTrail = [];
        }

        followingState.distanceAlongRoute = distanceAlongRoute;
        followingState.segmentIndex = projection.segmentIndex;
        followingState.isOffRoute = !onRoute;

        routeFollowingRef.current.set(driverId, followingState);

        // Sync to reactive state if there are meaningful changes
        // This triggers re-renders in LiveMap for polyline updates
        const hasSegmentChange = projection.segmentIndex !== prevSegmentIndex;
        const hasOffRouteChange = !onRoute !== prevIsOffRoute;
        const hasPathGrowth =
          (followingState.actualPathHistory?.length ?? 0) > prevPathLength + 5;

        if (hasSegmentChange || hasOffRouteChange || hasPathGrowth) {
          setRouteFollowingStates((prev) => {
            const newMap = new Map(prev);
            // Deep copy to ensure React detects the change
            newMap.set(driverId, { ...followingState });
            return newMap;
          });
        }
      }

      // Update position target
      if (existing) {
        const dist = approxSqDist(existing.target, targetPosition);
        if (dist > STOP_THRESHOLD_SQ) {
          positions.set(driverId, {
            ...existing,
            target: targetPosition,
            lastUpdated: now,
          });
        }
      } else {
        // New Driver
        positions.set(driverId, {
          lat: targetPosition.lat,
          lng: targetPosition.lng,
          target: targetPosition,
          bearing: projectedBearing,
          lastUpdated: now,
        });
      }
    },
    [tripsData],
  );

  // ============================================================================
  // ANIMATION LOOP
  // ============================================================================

  useEffect(() => {
    const tick = () => {
      const positions = positionsRef.current;
      let needsFlush = false;

      positions.forEach((pos, id) => {
        const distSq = approxSqDist(pos, pos.target);

        // If very close to target, snap to it
        if (distSq < STOP_THRESHOLD_SQ) {
          if (pos.lat !== pos.target.lat || pos.lng !== pos.target.lng) {
            pos.lat = pos.target.lat;
            pos.lng = pos.target.lng;
            needsFlush = true;
          }
          return;
        }

        // Interpolate position (Lerp)
        const next = interpolateLatLng(pos, pos.target, LERP_FACTOR);

        // Try to get route for bearing
        const driver = drivers.find((d) => d.id === id);
        const activeTrip = driver?.active_trip_id
          ? tripsData?.find((t) => t.id === driver.active_trip_id)
          : null;
        const route = activeTrip
          ? routeCacheRef.current.get(activeTrip.id)
          : null;

        // Calculate bearing
        let newBearing = pos.bearing;
        if (route && route.polyline.length >= 2) {
          // Get bearing from route direction
          const projection = findNearestPointOnPolyline(
            pos.target,
            route.polyline,
          );
          if (projection.segmentIndex < route.polyline.length - 1) {
            const segStart = route.polyline[projection.segmentIndex];
            const segEnd = route.polyline[projection.segmentIndex + 1];
            const routeBearing = calculateBearing(segStart, segEnd);
            // Smooth bearing transition
            newBearing = lerpBearing(pos.bearing, routeBearing, LERP_FACTOR);
          }
        } else if (distSq > BEARING_UPDATE_THRESHOLD_SQ) {
          // Fall back to GPS-based bearing if no route
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
  }, [flushPositions, drivers, tripsData]);

  // ============================================================================
  // REALTIME SUBSCRIPTIONS
  // ============================================================================

  useEffect(() => {
    if (!currentOrganization?.id) return;

    // 1. Broadcast Channel (Low Latency)
    const broadcastChannel = supabase
      .channel(BROADCAST_CHANNEL)
      .on("broadcast", { event: "location-update" }, (payload) => {
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

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  /**
   * Check if a driver needs a reroute
   */
  const getDriverRouteState = useCallback(
    (driverId: string): DriverRouteFollowingState | null => {
      return routeFollowingRef.current.get(driverId) ?? null;
    },
    [],
  );

  /**
   * Clear reroute flag after handling
   */
  const clearRerouteFlag = useCallback((driverId: string) => {
    const state = routeFollowingRef.current.get(driverId);
    if (state) {
      state.rerouteRequested = false;
      state.offRouteStartTime = null;
      state.deviationTrail = [];
    }
  }, []);

  return {
    drivers,
    trips: tripsData || [],
    loading: driversLoading || (tripsLoading && drivers.length === 0),
    // Route management
    setRouteForTrip,
    clearRouteForTrip,
    getRouteForTrip,
    getDriverRouteState,
    clearRerouteFlag,
    // Reactive route following states (for triggering UI updates)
    routeFollowingStates,
  };
}
