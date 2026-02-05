import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useQueryState } from "nuqs";
import { supabase } from "@/lib/supabase";
import { useOrganization } from "@/contexts/OrganizationContext";
import {
  Clock,
  MapPin,
  Calendar,
  TrendUp,
  Gauge,
  CalendarCheck,
  CircleNotch,
} from "@phosphor-icons/react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Trip, TripStatus } from "./trips/types";
import { Separator } from "@/components/ui/separator";
import { useTimezone } from "@/hooks/useTimezone";
import { formatInUserTimezone, getZonedTime } from "@/lib/timezone";

const timeRanges = [
  { label: "Last 24 Hours", value: "24h", hours: 24 },
  { label: "Last 7 Days", value: "7d", hours: 24 * 7 },
  { label: "Last 2 Weeks", value: "2w", hours: 24 * 14 },
  { label: "Last Month", value: "1m", hours: 24 * 30 },
] as const;

const statusColors: Record<TripStatus, string> = {
  pending: "bg-slate-100 text-slate-700 border-slate-200",
  assigned: "bg-blue-50 text-blue-700 border-blue-100",
  accepted: "bg-indigo-50 text-indigo-700 border-indigo-100",
  en_route: "bg-purple-50 text-purple-700 border-purple-100",
  arrived: "bg-amber-50 text-amber-700 border-amber-100",
  in_progress: "bg-blue-100 text-blue-800 border-blue-200",
  completed: "bg-emerald-50 text-emerald-700 border-emerald-100",
  cancelled: "bg-red-50 text-red-700 border-red-100",
  no_show: "bg-orange-50 text-orange-700 border-orange-100",
  waiting: "bg-amber-100 text-amber-800 border-amber-200",
};

export function DriverHistoryPage({ driverId }: { driverId: string }) {
  const { currentOrganization } = useOrganization();
  const [selectedRange, setSelectedRange] = useState<string>("24h");
  const [, setTripId] = useQueryState("tripId");
  const [, setPage] = useQueryState("page");
  const activeTimezone = useTimezone();

  const { data: trips, isLoading } = useQuery({
    queryKey: [
      "driver-history",
      currentOrganization?.id,
      driverId,
      selectedRange,
    ],
    queryFn: async () => {
      const range = timeRanges.find((r) => r.value === selectedRange);
      if (!range) throw new Error("Invalid range");

      const cutoffDate = new Date();
      cutoffDate.setHours(cutoffDate.getHours() - range.hours);

      const { data, error } = await supabase
        .from("trips")
        .select(
          `
          *,
          patient:patients(id, full_name, phone),
          driver:drivers(id, full_name, phone)
        `,
        )
        .eq("org_id", currentOrganization?.id)
        .eq("driver_id", driverId)
        .gte("pickup_time", cutoffDate.toISOString())
        .order("pickup_time", { ascending: false });

      if (error) throw error;
      return data as Trip[];
    },
    enabled: !!currentOrganization && !!driverId,
  });

  const stats = useMemo(() => {
    if (!trips) {
      return {
        total: 0,
        completed: 0,
        inProgress: 0,
        totalDistance: 0,
        totalDuration: 0,
      };
    }

    const completed = trips.filter((t) => t.status === "completed");
    const totalDistance = completed.reduce(
      (sum, t) =>
        sum +
        (Number(t.actual_distance_miles) || Number(t.distance_miles) || 0),
      0,
    );
    const totalDuration = completed.reduce(
      (sum, t) =>
        sum +
        (Number(t.actual_duration_minutes) || Number(t.duration_minutes) || 0),
      0,
    );

    return {
      total: trips.length,
      completed: completed.length,
      inProgress: trips.filter(
        (t) => t.status === "in_progress" || t.status === "en_route",
      ).length,
      totalDistance: Math.ceil(totalDistance),
      totalDuration: Math.ceil(totalDuration), // minutes
    };
  }, [trips]);

  const groupedTrips = useMemo(() => {
    if (!trips) return [];

    const groups: Map<string, Trip[]> = new Map();

    trips.forEach((trip) => {
      const zonedDate = getZonedTime(trip.pickup_time, activeTimezone);
      const dateKey = zonedDate.toDateString();

      if (!groups.has(dateKey)) {
        groups.set(dateKey, []);
      }
      groups.get(dateKey)!.push(trip);
    });

    return Array.from(groups.entries()).map(([dateKey, trips]) => ({
      date: new Date(dateKey),
      trips: trips.sort(
        (a, b) =>
          new Date(b.pickup_time).getTime() - new Date(a.pickup_time).getTime(),
      ),
    }));
  }, [trips, activeTimezone]);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <CircleNotch className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Driving History</h1>
          <p className="text-sm text-slate-500 mt-1">
            View your completed trips and performance metrics
          </p>
        </div>
      </div>

      {/* Time Range Selector */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {timeRanges.map((range) => (
          <button
            key={range.value}
            onClick={() => setSelectedRange(range.value)}
            className={cn(
              "px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap border",
              selectedRange === range.value
                ? "bg-[#3D5A3D] text-white border-[#3D5A3D] shadow-md"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50",
            )}
          >
            {range.label}
          </button>
        ))}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="p-4 border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
              <CalendarCheck
                weight="duotone"
                className="w-5 h-5 text-blue-600"
              />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
              <p className="text-xs text-slate-500">Total Trips</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
              <TrendUp weight="duotone" className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">
                {stats.completed}
              </p>
              <p className="text-xs text-slate-500">Completed</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
              <Clock weight="duotone" className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">
                {stats.inProgress}
              </p>
              <p className="text-xs text-slate-500">In Progress</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-violet-50 flex items-center justify-center">
              <MapPin weight="duotone" className="w-5 h-5 text-violet-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">
                {stats.totalDistance}
              </p>
              <p className="text-xs text-slate-500">Miles Driven</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center">
              <Gauge weight="duotone" className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">
                {stats.totalDuration}
              </p>
              <p className="text-xs text-slate-500">Minutes</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Trip Timeline by Date */}
      <div className="space-y-6">
        {groupedTrips.length === 0 ? (
          <Card className="p-12 text-center border border-slate-200">
            <div className="w-16 h-16 mx-auto rounded-full bg-slate-100 flex items-center justify-center mb-4">
              <Calendar weight="duotone" className="w-8 h-8 text-slate-300" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              No trips found
            </h3>
            <p className="text-sm text-slate-500">
              You don't have any trips in the selected time range
            </p>
          </Card>
        ) : (
          groupedTrips.map((group) => (
            <div key={group.date.toISOString()} className="space-y-3">
              {/* Date Header */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Calendar
                    weight="duotone"
                    className="w-5 h-5 text-slate-400"
                  />
                  <h3 className="text-lg font-bold text-slate-900">
                    {formatInUserTimezone(
                      group.date,
                      activeTimezone,
                      "EEEE, MMMM d, yyyy",
                    )}
                  </h3>
                </div>
                <Separator className="flex-1" />
                <span className="text-sm text-slate-500 font-medium">
                  {group.trips.length} trip{group.trips.length !== 1 ? "s" : ""}
                </span>
              </div>

              {/* Trips for this date */}
              <div className="grid gap-3">
                {group.trips.map((trip) => (
                  <Card
                    key={trip.id}
                    className="p-4 border border-slate-200 hover:shadow-md transition-shadow cursor-pointer active:scale-[0.99] active:bg-slate-50"
                    onClick={() => {
                      setTripId(trip.id);
                      setPage("trip-details");
                    }}
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex-1 space-y-3">
                        {/* Time and Status */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Clock
                              weight="duotone"
                              className="w-4 h-4 text-slate-400"
                            />
                            <span className="text-sm font-bold font-mono text-slate-900">
                              {formatInUserTimezone(
                                trip.pickup_time,
                                activeTimezone,
                                "hh:mm a",
                              )}
                            </span>
                          </div>
                          <span
                            className={cn(
                              "px-3 py-1 rounded-full text-xs uppercase font-bold tracking-wide border",
                              statusColors[trip.status],
                            )}
                          >
                            {trip.status.replace("_", " ")}
                          </span>
                        </div>

                        {/* Patient Info */}
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-slate-500 font-medium">
                            Patient:
                          </span>
                          <span className="text-sm font-semibold text-slate-900">
                            {trip.patient?.full_name || "Unknown"}
                          </span>
                        </div>

                        {/* Locations */}
                        <div className="space-y-2">
                          <div className="flex items-start gap-2">
                            <MapPin
                              weight="fill"
                              className="w-4 h-4 text-red-500 mt-0.5 shrink-0"
                            />
                            <div>
                              <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">
                                Pickup
                              </p>
                              <p className="text-sm text-slate-900">
                                {trip.pickup_location}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-start gap-2">
                            <MapPin
                              weight="fill"
                              className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0"
                            />
                            <div>
                              <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">
                                Dropoff
                              </p>
                              <p className="text-sm text-slate-900">
                                {trip.dropoff_location}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Trip Details */}
                      {trip.status === "completed" && (
                        <div className="flex gap-4 md:gap-6 text-center">
                          <div>
                            <p className="text-lg font-bold text-slate-900">
                              {Math.ceil(
                                Number(trip.actual_distance_miles) ||
                                  Number(trip.distance_miles) ||
                                  0,
                              )}
                            </p>
                            <p className="text-xs text-slate-500 uppercase tracking-wider">
                              Miles
                            </p>
                          </div>
                          {(Number(trip.actual_duration_minutes) ||
                            Number(trip.duration_minutes)) && (
                            <div>
                              <p className="text-lg font-bold text-slate-900">
                                {Math.ceil(
                                  Number(trip.actual_duration_minutes) ||
                                    Number(trip.duration_minutes) ||
                                    0,
                                )}
                              </p>
                              <p className="text-xs text-slate-500 uppercase tracking-wider">
                                Minutes
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
