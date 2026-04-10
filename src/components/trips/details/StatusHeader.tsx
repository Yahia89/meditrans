import { User, Phone, Envelope } from "@phosphor-icons/react";
import type { Trip } from "../types";

interface StatusHeaderProps {
  trip: Trip;
}

export function StatusHeader({ trip }: StatusHeaderProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-6">
      <div className="p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-slate-900">Trip Status</h2>
            <p className="text-sm text-slate-500">
              Manage the progression of this journey in real-time
            </p>
          </div>

          <div className="flex items-center gap-6 lg:gap-10">
            <div className="hidden md:block h-12 w-px bg-slate-100" />
            <div className="flex items-center gap-1.5 text-slate-500 group">
              <span className="text-[11px] font-bold tracking-tight text-slate-600">
                Trip ID: {trip.id.slice(0, 8).toUpperCase()}
              </span>
            </div>
            {/* Divider for desktop */}
            <div className="hidden md:block h-12 w-px bg-slate-100" />

            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
                <User weight="duotone" className="text-blue-600 w-6 h-6" />
              </div>
              <div className="min-w-0">
                <p className="font-bold text-slate-900 truncate">
                  {trip.patient?.full_name}
                </p>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-1.5">
                  <div className="flex items-center gap-1.5 text-slate-500 group">
                    <Phone
                      weight="duotone"
                      className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-500 transition-colors"
                    />
                    <span className="text-xs font-medium">
                      {trip.patient?.phone}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-500 group">
                    <Envelope
                      weight="duotone"
                      className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-500 transition-colors"
                    />
                    <span className="text-xs font-medium truncate max-w-[150px] lg:max-w-none">
                      {trip.patient?.email}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
