import type { Trip } from "../types";
import { Button } from "@/components/ui/button";
import {
  Pencil,
  Trash,
  MapPin,
  Calendar,
  Clock,
  FileText,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { formatInUserTimezone } from "@/lib/timezone";

interface TripInfoCardProps {
  trip: Trip;
  canManage: boolean;
  canDeleteTrips: boolean;
  onEdit?: (id: string) => void;
  onDeleteRequest: () => void;
  activeTimezone: string;
}

export function TripInfoCard({
  trip,
  canManage,
  canDeleteTrips,
  onEdit,
  onDeleteRequest,
  activeTimezone,
}: TripInfoCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              Trip Type
            </p>
            <h2 className="text-xl font-bold text-slate-900">
              {trip.trip_type}
            </h2>
          </div>
          <div className="flex items-center gap-2 self-start md:self-auto">
            {canManage && (
              <div className="flex items-center gap-2 mr-2">
                {onEdit && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onEdit(trip.id)}
                    className="h-8 gap-2 rounded-lg border-slate-200 text-slate-600 hover:bg-slate-50"
                  >
                    <Pencil weight="duotone" className="w-4 h-4" />
                    Edit
                  </Button>
                )}
                {canDeleteTrips && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onDeleteRequest}
                    className="h-8 w-8 p-0 rounded-lg border-slate-200 text-slate-400 hover:text-red-600 hover:border-red-100 hover:bg-red-50"
                  >
                    <Trash weight="duotone" className="w-4 h-4" />
                  </Button>
                )}
              </div>
            )}
            <div
              className={cn(
                "px-4 py-1.5 rounded-full text-[11px] font-bold tracking-wider border uppercase",
                trip.status === "completed"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                  : trip.status === "in_progress"
                    ? "bg-blue-50 text-blue-700 border-blue-100"
                    : trip.status === "cancelled" || trip.status === "no_show"
                      ? "bg-red-50 text-red-700 border-red-100"
                      : "bg-slate-50 text-slate-600 border-slate-200",
              )}
            >
              {trip.status.replace("_", " ")}
            </div>
          </div>
        </div>

        {trip.status === "cancelled" && trip.cancel_reason && (
          <div className="mb-8 p-4 bg-red-50 border border-red-100 rounded-xl">
            <p className="text-xs font-bold text-red-400 uppercase tracking-widest mb-1">
              Cancellation Reason
            </p>
            <p className="text-sm font-bold text-red-900">
              {trip.cancel_reason === "other"
                ? trip.cancel_explanation
                : trip.cancel_reason}
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
          <div className="space-y-6">
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center flex-shrink-0">
                <MapPin weight="duotone" className="w-5 h-5 text-rose-500" />
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Pickup Location
                </p>
                <p className="text-sm font-medium text-slate-900 leading-relaxed">
                  {trip.pickup_location}
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center flex-shrink-0">
                <MapPin weight="duotone" className="w-5 h-5 text-slate-400" />
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Dropoff Location
                </p>
                <p className="text-sm font-medium text-slate-900 leading-relaxed">
                  {trip.dropoff_location}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                <Calendar weight="duotone" className="w-5 h-5 text-blue-500" />
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Scheduled Date
                </p>
                <p className="text-sm font-medium text-slate-900">
                  {formatInUserTimezone(
                    trip.pickup_time,
                    activeTimezone,
                    "EEEE, MMMM d, yyyy",
                  )}
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
                <Clock weight="duotone" className="w-5 h-5 text-amber-600" />
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Pickup Time
                </p>
                <p className="text-sm font-medium text-slate-900">
                  {formatInUserTimezone(
                    trip.pickup_time,
                    activeTimezone,
                    "hh:mm a",
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>

        {trip.notes && (
          <div className="mt-12 p-6 bg-slate-50/50 rounded-2xl border border-slate-100">
            <div className="flex items-center gap-2 mb-3">
              <FileText weight="duotone" className="w-4 h-4 text-slate-400" />
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                Special Instructions
              </span>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed font-medium">
              {trip.notes}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
