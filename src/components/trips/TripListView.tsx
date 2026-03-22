import type { Trip, TripStatus } from "./types";
import { cn } from "@/lib/utils";
import { formatInUserTimezone } from "@/lib/timezone";
import { Car, List } from "lucide-react";

interface TripListViewProps {
  trips: Trip[];
  onTripClick: (id: string) => void;
  statusColors: Record<TripStatus, string>;
  timezone: string;
}

export function TripListView({
  trips,
  onTripClick,
  statusColors,
  timezone,
}: TripListViewProps) {
  if (trips.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mb-4">
          <List className="w-6 h-6 text-slate-300" />
        </div>
        <p className="text-slate-500">No trips for this date</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-100">
            <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Time
            </th>
            <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Patient
            </th>
            <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Type
            </th>
            <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Pickup
            </th>
            <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Driver
            </th>
            <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Status
            </th>
          </tr>
        </thead>
        <tbody>
          {trips.map((trip) => (
            <tr
              key={trip.id}
              onClick={() => onTripClick(trip.id)}
              className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer transition-colors"
            >
              <td className="py-3 px-4">
                <span className="text-sm font-medium text-slate-900">
                  {formatInUserTimezone(trip.pickup_time, timezone, "h:mm a")}
                </span>
              </td>
              <td className="py-3 px-4">
                <span className="text-sm text-slate-900">
                  {trip.patient?.full_name || "Unknown"}
                </span>
              </td>
              <td className="py-3 px-4">
                <span className="text-sm text-slate-600">{trip.trip_type}</span>
              </td>
              <td className="py-3 px-4">
                <span className="text-sm text-slate-600 max-w-[200px] truncate block">
                  {trip.pickup_location}
                </span>
              </td>
              <td className="py-3 px-4">
                <div className="flex items-center gap-2">
                  <Car className="w-4 h-4 text-slate-400" />
                  <span className="text-sm text-slate-600">
                    {trip.driver?.full_name || "Unassigned"}
                  </span>
                </div>
              </td>
              <td className="py-3 px-4">
                <span
                  className={cn(
                    "px-2.5 py-0.5 rounded-full text-xs font-semibold border",
                    statusColors[trip.status],
                  )}
                >
                  {trip.status.replace("_", " ").toUpperCase()}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
