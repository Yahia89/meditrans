import { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { Trip, TripStatus } from "./types";
import { MapPin, Clock, User, Car } from "lucide-react";

interface TripTimelineProps {
  trips: Trip[];
  onTripClick: (id: string) => void;
  selectedDate?: Date;
  viewMode?: "day" | "week";
  compact?: boolean;
}

// Status colors matching the system
const statusConfig: Record<
  TripStatus,
  { bg: string; border: string; text: string; dot: string }
> = {
  pending: {
    bg: "bg-slate-50",
    border: "border-slate-200",
    text: "text-slate-600",
    dot: "bg-slate-400",
  },
  assigned: {
    bg: "bg-blue-50",
    border: "border-blue-200",
    text: "text-blue-700",
    dot: "bg-blue-500",
  },
  accepted: {
    bg: "bg-indigo-50",
    border: "border-indigo-200",
    text: "text-indigo-700",
    dot: "bg-indigo-500",
  },
  arrived: {
    bg: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-700",
    dot: "bg-amber-500",
  },
  in_progress: {
    bg: "bg-blue-100",
    border: "border-blue-300",
    text: "text-blue-800",
    dot: "bg-blue-600 animate-pulse",
  },
  completed: {
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    text: "text-emerald-700",
    dot: "bg-emerald-500",
  },
  cancelled: {
    bg: "bg-red-50",
    border: "border-red-200",
    text: "text-red-600",
    dot: "bg-red-500",
  },
  no_show: {
    bg: "bg-orange-50",
    border: "border-orange-200",
    text: "text-orange-600",
    dot: "bg-orange-500",
  },
};

// Time hour markers
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function formatHour(hour: number): string {
  if (hour === 0) return "12 AM";
  if (hour === 12) return "12 PM";
  if (hour < 12) return `${hour} AM`;
  return `${hour - 12} PM`;
}

function getTimePosition(date: Date): number {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  return (hours * 60 + minutes) / (24 * 60);
}

function getEstimatedDuration(): number {
  // Default 45 min duration for display
  return 45 / (24 * 60);
}

// Group trips by patient for lane visualization
function groupTripsByPatient(
  trips: Trip[]
): Map<string, { patient: Trip["patient"]; trips: Trip[] }> {
  const groups = new Map<string, { patient: Trip["patient"]; trips: Trip[] }>();

  trips.forEach((trip) => {
    const patientId = trip.patient_id;
    if (!groups.has(patientId)) {
      groups.set(patientId, { patient: trip.patient, trips: [] });
    }
    groups.get(patientId)!.trips.push(trip);
  });

  // Sort trips within each group by time
  groups.forEach((group) => {
    group.trips.sort(
      (a, b) =>
        new Date(a.pickup_time).getTime() - new Date(b.pickup_time).getTime()
    );
  });

  return groups;
}

export function TripTimeline({
  trips,
  onTripClick,
  selectedDate = new Date(),
  compact = false,
}: TripTimelineProps) {
  // Filter trips for selected date
  const filteredTrips = useMemo(() => {
    const startOfDay = new Date(selectedDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(selectedDate);
    endOfDay.setHours(23, 59, 59, 999);

    return trips.filter((trip) => {
      const tripDate = new Date(trip.pickup_time);
      return tripDate >= startOfDay && tripDate <= endOfDay;
    });
  }, [trips, selectedDate]);

  // Group by patient
  const patientGroups = useMemo(
    () => groupTripsByPatient(filteredTrips),
    [filteredTrips]
  );

  // Current time position
  const now = new Date();
  const isToday = now.toDateString() === selectedDate.toDateString();
  const currentTimePosition = isToday ? getTimePosition(now) : -1;

  if (filteredTrips.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
          <Clock className="w-8 h-8 text-slate-300" />
        </div>
        <h3 className="text-lg font-semibold text-slate-900 mb-1">
          No trips scheduled
        </h3>
        <p className="text-sm text-slate-500 max-w-xs">
          There are no trips scheduled for{" "}
          {selectedDate.toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
        </p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Timeline Header */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 pb-2">
        <div className="flex items-center gap-4 mb-4">
          <h3 className="text-lg font-bold text-slate-900">
            {selectedDate.toLocaleDateString("en-US", {
              weekday: "long",
              month: "short",
              day: "numeric",
            })}
          </h3>
          <span className="text-sm text-slate-500">
            {filteredTrips.length} trip{filteredTrips.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Hour markers - horizontal scrollable on mobile */}
        <div className="overflow-x-auto -mx-4 px-4 scrollbar-hide">
          <div
            className="flex relative"
            style={{ minWidth: compact ? "600px" : "800px" }}
          >
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="flex-1 text-center"
                style={{ minWidth: compact ? "25px" : "33px" }}
              >
                <span
                  className={cn(
                    "text-[10px] font-medium",
                    hour % 3 === 0 ? "text-slate-600" : "text-slate-300"
                  )}
                >
                  {hour % 3 === 0 ? formatHour(hour) : "·"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Timeline Lanes - one per patient */}
      <div className="overflow-x-auto -mx-4 px-4 scrollbar-hide">
        <div
          className="relative pt-2"
          style={{ minWidth: compact ? "600px" : "800px" }}
        >
          {/* Grid lines */}
          <div className="absolute inset-0 flex pointer-events-none">
            {HOURS.map((hour) => (
              <div
                key={hour}
                className={cn(
                  "flex-1 border-l",
                  hour % 3 === 0 ? "border-slate-200" : "border-slate-100"
                )}
                style={{ minWidth: compact ? "25px" : "33px" }}
              />
            ))}
          </div>

          {/* Current time indicator */}
          {currentTimePosition >= 0 && (
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10"
              style={{ left: `${currentTimePosition * 100}%` }}
            >
              <div className="absolute -top-1 -left-1.5 w-3 h-3 rounded-full bg-red-500" />
            </div>
          )}

          {/* Patient Lanes */}
          <div className="space-y-3 relative">
            {Array.from(patientGroups.entries()).map(
              ([patientId, { patient, trips: patientTrips }]) => (
                <div key={patientId} className="relative">
                  {/* Patient label */}
                  <div className="flex items-center gap-2 mb-2 sticky left-0 bg-white pr-2 z-10">
                    <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                      <User className="w-3 h-3 text-slate-500" />
                    </div>
                    <span className="text-xs font-medium text-slate-700 truncate max-w-[120px]">
                      {patient?.full_name || "Unknown"}
                    </span>
                    <span className="text-xs text-slate-400">
                      ({patientTrips.length})
                    </span>
                  </div>

                  {/* Trip blocks */}
                  <div className="relative h-14 bg-slate-50/50 rounded-lg border border-slate-100">
                    {patientTrips.map((trip) => {
                      const tripDate = new Date(trip.pickup_time);
                      const position = getTimePosition(tripDate);
                      const duration = getEstimatedDuration();
                      const config = statusConfig[trip.status];

                      return (
                        <button
                          key={trip.id}
                          onClick={() => onTripClick(trip.id)}
                          className={cn(
                            "absolute top-1 bottom-1 rounded-md border-2 cursor-pointer hover:shadow-lg transition-all duration-200 group overflow-hidden",
                            config.bg,
                            config.border,
                            "hover:scale-[1.02] hover:z-20"
                          )}
                          style={{
                            left: `${position * 100}%`,
                            width: `${duration * 100}%`,
                            minWidth: "60px",
                          }}
                        >
                          {/* Status dot */}
                          <div
                            className={cn(
                              "absolute top-1.5 left-1.5 w-2 h-2 rounded-full",
                              config.dot
                            )}
                          />

                          {/* Trip info */}
                          <div className="px-2 pt-4 pb-1 h-full flex flex-col justify-between">
                            <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide opacity-80">
                              <Clock className="w-2.5 h-2.5" />
                              {tripDate.toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </div>
                            <div
                              className={cn(
                                "text-[9px] font-medium truncate",
                                config.text
                              )}
                            >
                              {trip.trip_type}
                            </div>
                          </div>

                          {/* Hover tooltip */}
                          <div className="absolute bottom-full left-0 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-30">
                            <div className="bg-slate-900 text-white text-xs rounded-lg py-2 px-3 shadow-xl max-w-[200px]">
                              <div className="font-semibold mb-1">
                                {trip.trip_type}
                              </div>
                              <div className="flex items-start gap-1 text-slate-300 mb-1">
                                <MapPin className="w-3 h-3 mt-0.5 shrink-0" />
                                <span className="line-clamp-2">
                                  {trip.pickup_location}
                                </span>
                              </div>
                              <div className="flex items-center gap-1 text-slate-300">
                                <Car className="w-3 h-3" />
                                {trip.driver?.full_name || "Unassigned"}
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-6 pt-4 border-t border-slate-100">
        <div className="flex flex-wrap gap-3 text-xs">
          {Object.entries(statusConfig)
            .slice(0, 6)
            .map(([status, config]) => (
              <div key={status} className="flex items-center gap-1.5">
                <div className={cn("w-2 h-2 rounded-full", config.dot)} />
                <span className="text-slate-600 capitalize">
                  {status.replace("_", " ")}
                </span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

// Mobile-optimized vertical timeline
export function TripTimelineVertical({
  trips,
  onTripClick,
  selectedDate = new Date(),
}: TripTimelineProps) {
  // Filter and sort trips for selected date
  const filteredTrips = useMemo(() => {
    const startOfDay = new Date(selectedDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(selectedDate);
    endOfDay.setHours(23, 59, 59, 999);

    return trips
      .filter((trip) => {
        const tripDate = new Date(trip.pickup_time);
        return tripDate >= startOfDay && tripDate <= endOfDay;
      })
      .sort(
        (a, b) =>
          new Date(a.pickup_time).getTime() - new Date(b.pickup_time).getTime()
      );
  }, [trips, selectedDate]);

  // Group by hour for visual organization
  const hourGroups = useMemo(() => {
    const groups: Map<number, Trip[]> = new Map();
    filteredTrips.forEach((trip) => {
      const hour = new Date(trip.pickup_time).getHours();
      if (!groups.has(hour)) {
        groups.set(hour, []);
      }
      groups.get(hour)!.push(trip);
    });
    return groups;
  }, [filteredTrips]);

  const now = new Date();
  const isToday = now.toDateString() === selectedDate.toDateString();
  const currentHour = now.getHours();

  if (filteredTrips.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mb-3">
          <Clock className="w-6 h-6 text-slate-300" />
        </div>
        <h3 className="text-base font-semibold text-slate-900 mb-1">
          No trips today
        </h3>
        <p className="text-sm text-slate-500">
          Schedule trips to see them here
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-slate-900">
          {selectedDate.toLocaleDateString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
          })}
        </h3>
        <span className="text-sm font-medium text-slate-500">
          {filteredTrips.length} trip{filteredTrips.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-[23px] top-0 bottom-0 w-0.5 bg-gradient-to-b from-slate-200 via-slate-200 to-transparent" />

        {/* Time slots */}
        <div className="space-y-1">
          {Array.from(hourGroups.entries())
            .sort(([a], [b]) => a - b)
            .map(([hour, hourTrips]) => {
              const isPast = isToday && hour < currentHour;
              const isCurrent = isToday && hour === currentHour;

              return (
                <div key={hour} className="relative">
                  {/* Hour marker */}
                  <div className="flex items-center gap-3 mb-2">
                    <div
                      className={cn(
                        "w-12 h-12 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 z-10",
                        isCurrent
                          ? "bg-[#3D5A3D] text-white shadow-lg shadow-[#3D5A3D]/20"
                          : isPast
                          ? "bg-slate-100 text-slate-400"
                          : "bg-white border-2 border-slate-200 text-slate-700"
                      )}
                    >
                      {formatHour(hour)}
                    </div>
                    {isCurrent && (
                      <span className="text-xs font-semibold text-[#3D5A3D] uppercase tracking-wide">
                        Now
                      </span>
                    )}
                  </div>

                  {/* Trips at this hour */}
                  <div className="ml-16 space-y-2">
                    {hourTrips.map((trip) => {
                      const config = statusConfig[trip.status];
                      const tripTime = new Date(trip.pickup_time);

                      return (
                        <button
                          key={trip.id}
                          onClick={() => onTripClick(trip.id)}
                          className={cn(
                            "w-full text-left p-4 rounded-xl border-2 transition-all duration-200 group",
                            config.bg,
                            config.border,
                            "hover:shadow-md hover:scale-[1.01] active:scale-[0.99]"
                          )}
                        >
                          {/* Status badge */}
                          <div className="flex items-center justify-between mb-2">
                            <span
                              className={cn(
                                "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide",
                                config.bg,
                                config.text,
                                "border",
                                config.border
                              )}
                            >
                              {trip.status.replace("_", " ")}
                            </span>
                            <span className="text-xs font-medium text-slate-500">
                              {tripTime.toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>

                          {/* Trip type */}
                          <h4 className="font-semibold text-slate-900 mb-2">
                            {trip.trip_type}
                          </h4>

                          {/* Patient */}
                          <div className="flex items-center gap-2 text-sm text-slate-600 mb-2">
                            <User className="w-4 h-4" />
                            <span className="truncate">
                              {trip.patient?.full_name || "Unknown Patient"}
                            </span>
                          </div>

                          {/* Locations */}
                          <div className="space-y-1.5">
                            <div className="flex items-start gap-2 text-xs">
                              <MapPin className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                              <span className="text-slate-600 line-clamp-1">
                                {trip.pickup_location}
                              </span>
                            </div>
                            <div className="flex items-start gap-2 text-xs">
                              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                              <span className="text-slate-600 line-clamp-1">
                                {trip.dropoff_location}
                              </span>
                            </div>
                          </div>

                          {/* Driver */}
                          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                              <Car className="w-3.5 h-3.5" />
                              <span>
                                {trip.driver?.full_name || "Unassigned"}
                              </span>
                            </div>
                            {trip.status === "in_progress" && (
                              <div className="flex items-center gap-1 text-blue-600">
                                <div className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
                                <span className="text-xs font-semibold">
                                  Active
                                </span>
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
