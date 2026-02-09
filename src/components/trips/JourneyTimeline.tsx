/**
 * JourneyTimeline - Route-level cached Journey Timeline component
 *
 * This module implements a route-level caching pattern for the journey timeline.
 * The key optimization is that the journey data (same-day trips for a patient)
 * is cached at the day/patient level, not at the individual trip level.
 *
 * When navigating between legs of the same journey, the timeline data is
 * already cached and stable, eliminating rerenders and refetches.
 */

import React, { memo, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { formatInUserTimezone, parseZonedTime } from "@/lib/timezone";
import { Path, Pencil, Timer } from "@phosphor-icons/react";
import type { Trip } from "./types";

// ============================================================================
// TYPES
// ============================================================================

interface JourneyTimelineProps {
  currentTripId: string;
  patientId: string;
  pickupTime: string;
  timezone: string;
  canManage?: boolean;
  onNavigate: (id: string) => void;
  onEditMileage?: (trip: Trip) => void;
  onEditWaitTime?: (trip: Trip) => void;
}

interface TimelineLegProps {
  trip: Trip;
  index: number;
  isLast: boolean;
  isCurrent: boolean;
  timezone: string;
  canManage?: boolean;
  totalDistance: number;
  onNavigate: (id: string) => void;
  onEditMileage?: (trip: Trip) => void;
  onEditWaitTime?: (trip: Trip) => void;
}

// ============================================================================
// HOOK: useJourneyTrips
// ============================================================================

/**
 * Custom hook for fetching journey trips with route-level caching.
 *
 * Key optimizations:
 * - Query key is based on patient + date (not tripId), so navigating between
 *   legs of the same journey reuses the cached data
 * - staleTime of 5 minutes prevents unnecessary refetches
 * - placeholderData keeps previous data while refetching (no loading flash)
 */
export function useJourneyTrips(
  patientId: string | undefined,
  pickupTime: string | undefined,
  timezone: string,
) {
  // Compute a stable date string for the query key
  const dateKey = useMemo(() => {
    if (!pickupTime) return null;
    return formatInUserTimezone(pickupTime, timezone, "yyyy-MM-dd");
  }, [pickupTime, timezone]);

  return useQuery({
    // Route-level cache: keyed by patient + date, NOT by tripId
    queryKey: ["journey-trips", patientId, dateKey],
    queryFn: async () => {
      if (!patientId || !dateKey) return [];

      const start = parseZonedTime(dateKey, "00:00", timezone).toISOString();
      const end = parseZonedTime(dateKey, "23:59:59", timezone).toISOString();

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
    enabled: !!patientId && !!dateKey,
    // Prevent refetches for 5 minutes - journey data rarely changes
    staleTime: 5 * 60 * 1000,
    // Keep previous data while refetching to avoid flicker
    placeholderData: (previousData) => previousData,
    // Cache for 30 minutes even after unmount
    gcTime: 30 * 60 * 1000,
  });
}

// ============================================================================
// COMPONENT: TimelineLeg (individual leg - pure component)
// ============================================================================

const TimelineLeg = memo(function TimelineLeg({
  trip,
  index,
  isLast,
  isCurrent,
  timezone,
  canManage,
  totalDistance,
  onNavigate,
  onEditMileage,
  onEditWaitTime,
}: TimelineLegProps) {
  // Stable click handler
  const handleClick = useCallback(() => {
    if (!isCurrent) {
      onNavigate(trip.id);
    }
  }, [isCurrent, onNavigate, trip.id]);

  const handleEditClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onEditMileage?.(trip);
    },
    [onEditMileage, trip],
  );

  const distance = Math.ceil(
    Number(trip.actual_distance_miles || trip.distance_miles || 0),
  );

  const waitMinutes = Number(trip.total_waiting_minutes) || 0;

  return (
    <div className="relative pl-10 group">
      {/* Visual Node */}
      <div
        className={cn(
          "absolute left-0 top-1 w-8 h-8 rounded-xl border-2 flex items-center justify-center transition-all duration-300 z-10",
          isCurrent
            ? "bg-blue-600 border-blue-600 text-white shadow-lg shadow-blue-200"
            : "bg-white border-slate-200 text-slate-400 group-hover:border-blue-300 group-hover:text-blue-400",
        )}
      >
        <span className="text-xs font-bold">{index + 1}</span>
      </div>

      {/* Content */}
      <div
        onClick={handleClick}
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
            {formatInUserTimezone(trip.pickup_time, timezone, "h:mm a")}
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

        {/* Distance Badge */}
        {distance > 0 && (
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
              {distance} miles
              {isCurrent &&
                trip.status === "completed" &&
                canManage &&
                onEditMileage && (
                  <button
                    onClick={handleEditClick}
                    className="ml-1 p-1 hover:bg-blue-200 rounded-full text-blue-600 transition-colors"
                    title="Edit Mileage"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                )}
            </div>
          </div>
        )}

        {/* Wait Time Badge - Only show for completed trips */}
        {trip.status === "completed" &&
          (waitMinutes > 0 || (isCurrent && canManage && onEditWaitTime)) && (
            <div className="mt-2 pt-2 border-t border-slate-100/80">
              <div
                className={cn(
                  "inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-semibold",
                  isCurrent
                    ? "bg-amber-100 text-amber-700"
                    : "bg-slate-100 text-slate-600",
                )}
              >
                <Timer weight="bold" className="w-3.5 h-3.5" />
                {waitMinutes} min wait
                {isCurrent && canManage && onEditWaitTime && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditWaitTime?.(trip);
                    }}
                    className="ml-1 p-1 hover:bg-amber-200 rounded-full text-amber-600 transition-colors"
                    title="Edit Wait Time"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          )}
      </div>

      {/* Total distance only on last item */}
      {isLast && totalDistance > 0 && (
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
});

// ============================================================================
// COMPONENT: JourneyTimeline (main exported component)
// ============================================================================

export const JourneyTimeline = memo(function JourneyTimeline({
  currentTripId,
  patientId,
  pickupTime,
  timezone,
  canManage,
  onNavigate,
  onEditMileage,
  onEditWaitTime,
}: JourneyTimelineProps) {
  // Use the route-level cached hook
  const { data: trips } = useJourneyTrips(patientId, pickupTime, timezone);

  // Memoize total distance calculation
  const totalDistance = useMemo(() => {
    if (!trips) return 0;
    return trips.reduce(
      (sum, t) =>
        sum + (Number(t.actual_distance_miles || t.distance_miles) || 0),
      0,
    );
  }, [trips]);

  // Don't render if no trips or only one trip
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
          {trips.map((trip, idx) => (
            <TimelineLeg
              key={trip.id}
              trip={trip}
              index={idx}
              isLast={idx === trips.length - 1}
              isCurrent={trip.id === currentTripId}
              timezone={timezone}
              canManage={canManage}
              totalDistance={totalDistance}
              onNavigate={onNavigate}
              onEditMileage={onEditMileage}
              onEditWaitTime={onEditWaitTime}
            />
          ))}
        </div>
      </div>
    </div>
  );
});

export default JourneyTimeline;
