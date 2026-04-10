import { useMemo } from "react";
import type { Trip, TripStatus } from "./types";
import { cn } from "@/lib/utils";
import { formatInUserTimezone } from "@/lib/timezone";
import {
  MapPin,
  Car,
  User,
  Calendar as CalendarIcon,
} from "lucide-react";
import { Plus } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";

interface TripCardsViewProps {
  trips: Trip[];
  onTripClick: (id: string) => void;
  statusColors: Record<TripStatus, string>;
  timezone: string;
  onQuickAdd: (patientId: string, patientName: string, date: Date) => void;
}

export function TripCardsView({
  trips,
  onTripClick,
  statusColors,
  timezone,
  onQuickAdd,
}: TripCardsViewProps) {
  const groupedTrips = useMemo(() => {
    const groups: Record<string, Trip[]> = {};
    trips.forEach((trip) => {
      const key = trip.patient_id || "unknown";
      if (!groups[key]) groups[key] = [];
      groups[key].push(trip);
    });
    return Object.values(groups).sort((a, b) => {
      const timeA = new Date(a[0]?.pickup_time || 0).getTime();
      const timeB = new Date(b[0]?.pickup_time || 0).getTime();
      return timeA - timeB;
    });
  }, [trips]);

  if (trips.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mb-4">
          <CalendarIcon className="w-6 h-6 text-slate-300" />
        </div>
        <p className="text-slate-500">No trips for this date</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {groupedTrips.map((group) => {
        const patient = group[0].patient;
        const sortedGroup = [...group].sort(
          (a, b) =>
            new Date(a.pickup_time).getTime() -
            new Date(b.pickup_time).getTime(),
        );

        return (
          <div
            key={group[0].patient_id || "unknown"}
            className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden"
          >
            {/* Patient Header */}
            <div className="p-4 border-b border-slate-50 bg-slate-50/50 flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center shrink-0 shadow-sm">
                <User className="w-5 h-5 text-slate-700" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-slate-900 truncate">
                    {patient?.full_name || "Unknown Patient"}
                  </p>
                  <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full font-medium">
                    {group.length} Trip{group.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-medium">
                  {patient?.phone}
                </p>
              </div>
            </div>

            {/* Trips Timeline */}
            <div className="p-4 space-y-0 relative">
              {/* Vertical Timeline Line */}
              {sortedGroup.length > 1 && (
                <div className="absolute left-[29px] top-4 bottom-8 w-0.5 bg-slate-100" />
              )}

              {sortedGroup.map((trip, index) => (
                <div
                  key={trip.id}
                  onClick={() => onTripClick(trip.id)}
                  className="relative pl-8 pb-6 last:pb-0 z-10 cursor-pointer group"
                >
                  {/* Timeline Node */}
                  <div
                    className={cn(
                      "absolute left-0 top-1 w-7 h-7 rounded-full border-2 flex items-center justify-center bg-white transition-colors",
                      trip.status === "completed"
                        ? "border-emerald-500 text-emerald-500"
                        : trip.status === "in_progress"
                          ? "border-blue-500 text-blue-500"
                          : trip.status === "cancelled"
                            ? "border-red-200 text-red-300"
                            : "border-slate-300 text-slate-400 group-hover:border-blue-400 group-hover:text-blue-400",
                    )}
                  >
                    {index + 1}
                  </div>

                  {/* Trip Card Content */}
                  <div className="bg-slate-50/50 rounded-lg border border-slate-100 p-3 hover:bg-white hover:shadow-md hover:border-blue-200 transition-all">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-bold text-slate-700 font-mono">
                        {formatInUserTimezone(
                          trip.pickup_time,
                          timezone,
                          "h:mm a",
                        )}
                      </span>
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-wide border",
                          statusColors[trip.status],
                        )}
                      >
                        {trip.status.replace("_", " ")}
                      </span>
                    </div>

                    <div className="text-xs text-slate-500 mb-2 font-medium uppercase tracking-wider">
                      {trip.trip_type}
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex items-start gap-2">
                        <MapPin className="w-3.5 h-3.5 text-red-500 mt-0.5 shrink-0" />
                        <span className="text-slate-700 leading-tight">
                          {trip.pickup_location}
                        </span>
                      </div>
                      <div className="flex items-start gap-2">
                        <MapPin className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                        <span className="text-slate-700 leading-tight">
                          {trip.dropoff_location}
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-200/50 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Car className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="text-xs text-slate-600 font-medium truncate">
                          {trip.driver?.full_name || "Unassigned"}
                        </span>
                      </div>
                      <div className="px-1.5 py-0.5 rounded bg-slate-100/80 border border-slate-200/50 shrink-0">
                        <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tight tabular-nums">
                          ID: {trip.id.split("-")[0].toUpperCase()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {/* Quick Add Leg Button */}
              <div className="relative pl-8 pt-2">
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    const date = new Date(sortedGroup[0].pickup_time);
                    onQuickAdd(
                      sortedGroup[0].patient_id,
                      patient?.full_name || "Patient",
                      date,
                    );
                  }}
                  variant="ghost"
                  className="w-full h-auto min-h-[44px] py-2.5 border border-slate-200 bg-white shadow-sm rounded-xl text-slate-500 hover:text-[#3D5A3D] hover:border-[#3D5A3D] hover:bg-[#3D5A3D]/5 transition-all flex items-center justify-center gap-2 group"
                >
                  <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center group-hover:border-[#3D5A3D] group-hover:text-[#3D5A3D] transition-colors flex-shrink-0">
                    <Plus className="w-3 h-3 sm:w-3.5 sm:h-3.5" weight="bold" />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-wider whitespace-nowrap">
                    Add Leg
                  </span>
                </Button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
