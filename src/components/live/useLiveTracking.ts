import { useOrganization } from "@/contexts/OrganizationContext";
import {
  calculateBearing,
  approxSqDist,
  findNearestPointOnPolyline,
  getPositionAtDistance,
  getDistanceAtSegment,
  decodePolyline,
  calculateCumulativeDistances,
  lerpBearing,
  haversineDistance,
  interpolateLatLng,
  type PolylinePoint,
} from "@/lib/geo";
import { supabase } from "@/lib/supabase";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import type { LiveDriver, LiveTrip, DriverRouteFollowingState } from "./types";

// ============================================================================
// CONFIGURATION
// ============================================================================

// Route-constrained animation: glide along polyline segments (turn-by-turn)
const ROUTE_ADVANCE_SPEED = 0.06; // % of remaining distance to close per frame (0.03=slow, 0.10=snappy)
const FALLBACK_LERP_FACTOR = 0.08; // For drivers without a route
const STOP_THRESHOLD_SQ = 0.000000001; // Stop interpolating when very close
const BEARING_UPDATE_THRESHOLD_SQ = 0.0000005; // Only update bearing if moved

// Broadcast channel
const BROADCAST_CHANNEL = "drivers-live";

// ============================================================================
// TYPES
// ============================================================================

/** Mutable position tracking (avoids React re-renders on every frame) */
interface PositionState {
  lat: number;
  lng: number;
  /** Target position along the route (where the driver should animate to) */
  target: { lat: number; lng: number };
  bearing: number;
  lastUpdated: number;
  /** Distance along route that we are currently animating towards (meters) */
  targetDistanceAlongRoute: number;
  /** Distance along route we have currently animated to (meters) */
  currentDistanceAlongRoute: number;
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
            targetDistanceAlongRoute: 0,
            currentDistanceAlongRoute: 0,
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

  // Handle Incoming Position Updates - project onto route for turn-by-turn animation
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

      // Route-following state for trip summary/billing
      const prevFollowingState = routeFollowingRef.current.get(driverId);
      const followingState: DriverRouteFollowingState = prevFollowingState || {
        distanceAlongRoute: 0,
        totalDistance: route?.totalDistance,
        segmentIndex: 0,
        actualPathHistory: [],
      };

      // Always track actual GPS path for trip summary & billing
      const pathHistory = followingState.actualPathHistory || [];
      const lastPoint = pathHistory[pathHistory.length - 1];
      if (
        !lastPoint ||
        Math.abs(lastPoint.lat - rawPosition.lat) > 0.00001 ||
        Math.abs(lastPoint.lng - rawPosition.lng) > 0.00001
      ) {
        if (pathHistory.length < 2000) {
          pathHistory.push({ ...rawPosition });
          followingState.actualPathHistory = pathHistory;
        }
      }

      if (route && route.polyline.length >= 2) {
        // Project GPS onto polyline to find where the driver is along the route
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

        // Get the on-route target position for the animation
        const routePosition = getPositionAtDistance(
          route.polyline,
          route.cumulativeDistances,
          distanceAlongRoute,
        );

        // Check if driver is close enough to snap to route (within ~80m)
        const distFromRoute = haversineDistance(
          rawPosition,
          routePosition.position,
        );

        let targetPosition: PolylinePoint;
        let projectedBearing: number;

        if (distFromRoute < 80) {
          // Snap to route for smooth turn-by-turn animation
          targetPosition = routePosition.position;
          projectedBearing = routePosition.bearing;
        } else {
          // Driver is far from planned route - animate to actual GPS position
          // This handles the case where the driver takes a different route
          targetPosition = rawPosition;
          projectedBearing = newHeading ?? existing?.bearing ?? 0;
        }

        // Track previous state for determining re-render triggers
        const prevSegmentIndex = prevFollowingState?.segmentIndex ?? -1;
        const prevPathLength =
          prevFollowingState?.actualPathHistory?.length ?? 0;

        followingState.totalDistance = route.totalDistance;
        followingState.distanceAlongRoute = distanceAlongRoute;
        followingState.segmentIndex = projection.segmentIndex;

        routeFollowingRef.current.set(driverId, followingState);

        // Sync to reactive state for UI updates (polyline segments etc.)
        const hasSegmentChange = projection.segmentIndex !== prevSegmentIndex;
        const hasPathGrowth =
          (followingState.actualPathHistory?.length ?? 0) > prevPathLength + 5;

        if (hasSegmentChange || hasPathGrowth) {
          setRouteFollowingStates((prev) => {
            const newMap = new Map(prev);
            newMap.set(driverId, { ...followingState });
            return newMap;
          });
        }

        // Update position target for route-constrained animation
        if (existing) {
          positions.set(driverId, {
            ...existing,
            target: targetPosition,
            bearing: projectedBearing,
            lastUpdated: now,
            targetDistanceAlongRoute: distanceAlongRoute,
          });
        } else {
          positions.set(driverId, {
            lat: targetPosition.lat,
            lng: targetPosition.lng,
            target: targetPosition,
            bearing: projectedBearing,
            lastUpdated: now,
            targetDistanceAlongRoute: distanceAlongRoute,
            currentDistanceAlongRoute: distanceAlongRoute,
          });
        }
      } else {
        // No route available - use raw GPS position
        routeFollowingRef.current.set(driverId, followingState);

        if (existing) {
          const dist = approxSqDist(existing.target, rawPosition);
          if (dist > STOP_THRESHOLD_SQ) {
            positions.set(driverId, {
              ...existing,
              target: rawPosition,
              lastUpdated: now,
            });
          }
        } else {
          positions.set(driverId, {
            lat: rawPosition.lat,
            lng: rawPosition.lng,
            target: rawPosition,
            bearing: newHeading ?? 0,
            lastUpdated: now,
            targetDistanceAlongRoute: 0,
            currentDistanceAlongRoute: 0,
          });
        }
      }
    },
    [tripsData],
  );

  // ============================================================================
  // ANIMATION LOOP — Route-Constrained Turn-by-Turn Glide
  // ============================================================================

  useEffect(() => {
    const tick = () => {
      const positions = positionsRef.current;
      let needsFlush = false;

      positions.forEach((pos, id) => {
        // Find the driver and their active trip's route
        const driver = drivers.find((d) => d.id === id);
        const activeTrip = driver?.active_trip_id
          ? tripsData?.find((t) => t.id === driver.active_trip_id)
          : null;
        const route = activeTrip
          ? routeCacheRef.current.get(activeTrip.id)
          : null;

        if (route && route.polyline.length >= 2) {
          // ─── Route-constrained animation ───
          // Advance currentDistanceAlongRoute toward targetDistanceAlongRoute
          // This makes the marker glide along polyline segments through turns

          const remaining =
            pos.targetDistanceAlongRoute - pos.currentDistanceAlongRoute;

          if (Math.abs(remaining) < 0.1) {
            // Close enough – snap
            if (
              pos.currentDistanceAlongRoute !== pos.targetDistanceAlongRoute
            ) {
              pos.currentDistanceAlongRoute = pos.targetDistanceAlongRoute;
              const snap = getPositionAtDistance(
                route.polyline,
                route.cumulativeDistances,
                pos.currentDistanceAlongRoute,
              );
              pos.lat = snap.position.lat;
              pos.lng = snap.position.lng;
              pos.bearing = snap.bearing;
              needsFlush = true;
            }
            return;
          }

          // Advance the distance by a fraction of the remaining gap each frame
          const advance = remaining * ROUTE_ADVANCE_SPEED;
          pos.currentDistanceAlongRoute += advance;

          // Get new position along the polyline at this distance
          const newPos = getPositionAtDistance(
            route.polyline,
            route.cumulativeDistances,
            pos.currentDistanceAlongRoute,
          );

          // Smooth bearing transition
          const newBearing = lerpBearing(
            pos.bearing,
            newPos.bearing,
            ROUTE_ADVANCE_SPEED * 1.5,
          );

          pos.lat = newPos.position.lat;
          pos.lng = newPos.position.lng;
          pos.bearing = newBearing;
          needsFlush = true;
        } else {
          // ─── Fallback: simple lerp for drivers without a route ───
          const distSq = approxSqDist(pos, pos.target);

          if (distSq < STOP_THRESHOLD_SQ) {
            if (pos.lat !== pos.target.lat || pos.lng !== pos.target.lng) {
              pos.lat = pos.target.lat;
              pos.lng = pos.target.lng;
              needsFlush = true;
            }
            return;
          }

          const next = interpolateLatLng(pos, pos.target, FALLBACK_LERP_FACTOR);

          // Calculate bearing
          let newBearing = pos.bearing;
          if (distSq > BEARING_UPDATE_THRESHOLD_SQ) {
            newBearing = calculateBearing(pos, pos.target);
          }

          pos.lat = next.lat;
          pos.lng = next.lng;
          pos.bearing = newBearing;
          needsFlush = true;
        }
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
   * Get driver's route following state (for trip summary / billing)
   */
  const getDriverRouteState = useCallback(
    (driverId: string): DriverRouteFollowingState | null => {
      return routeFollowingRef.current.get(driverId) ?? null;
    },
    [],
  );

  return {
    drivers,
    trips: tripsData || [],
    loading: driversLoading || (tripsLoading && drivers.length === 0),
    // Route management
    setRouteForTrip,
    clearRouteForTrip,
    getRouteForTrip,
    getDriverRouteState,
    // Reactive route following states (for triggering UI updates)
    routeFollowingStates,
  };
}
