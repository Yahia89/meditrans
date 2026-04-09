import type { Trip } from "../types";
import { Path, Timer, PencilSimpleLine } from "@phosphor-icons/react";

interface TripMetricsProps {
  trip: Trip;
  canManage: boolean;
  onEditMileage: (trip: Trip) => void;
  onEditWaitTime: (trip: Trip) => void;
}

export function TripMetrics({
  trip,
  canManage,
  onEditMileage,
  onEditWaitTime,
}: TripMetricsProps) {
  if (trip.status !== "completed" || !canManage) return null;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
      <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-6">
        Trip Metrics
      </h3>
      <div className="grid grid-cols-2 gap-4">
        {/* Mileage */}
        <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Path weight="duotone" className="w-4 h-4 text-blue-500" />
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Distance
              </span>
            </div>
            <button
              onClick={() => onEditMileage(trip)}
              className="p-1.5 hover:bg-blue-100 rounded-lg text-blue-600 transition-colors"
              title="Edit Mileage"
            >
              <PencilSimpleLine className="w-4 h-4" />
            </button>
          </div>
          <p className="text-2xl font-bold text-slate-900">
            {Math.ceil(
              Number(
                trip.actual_distance_miles || trip.distance_miles || 0,
              ),
            )}{" "}
            <span className="text-sm font-semibold text-slate-500">
              miles
            </span>
          </p>
        </div>

        {/* Wait Time */}
        <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Timer
                weight="duotone"
                className="w-4 h-4 text-amber-500"
              />
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Wait Time
              </span>
            </div>
            <button
              onClick={() => onEditWaitTime(trip)}
              className="p-1.5 hover:bg-amber-100 rounded-lg text-amber-600 transition-colors"
              title="Edit Wait Time"
            >
              <PencilSimpleLine className="w-4 h-4" />
            </button>
          </div>
          <p className="text-2xl font-bold text-slate-900">
            {Number(trip.total_waiting_minutes) || 0}{" "}
            <span className="text-sm font-semibold text-slate-500">
              minutes
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
