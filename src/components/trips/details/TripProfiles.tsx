import type { Trip } from "../types";
import { User, Phone, Envelope, Car } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";

interface PatientProfileCardProps {
  trip: Trip;
}

export function PatientProfileCard({ trip }: PatientProfileCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
      <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-6">
        Patient Profile
      </h3>
      <div className="flex items-center gap-4 mb-6">
        <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center">
          <User weight="duotone" className="text-blue-600 w-6 h-6" />
        </div>
        <div>
          <p className="font-bold text-slate-900">
            {trip.patient?.full_name}
          </p>
          <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mt-0.5">
            Member since{" "}
            {trip.patient?.created_at
              ? new Date(trip.patient.created_at).getFullYear()
              : "2025"}
          </p>
        </div>
      </div>
      <div className="space-y-4 pt-6 border-t border-slate-50">
        <div className="flex items-center gap-3 text-sm font-medium text-slate-600">
          <Phone weight="duotone" className="w-5 h-5 text-slate-400" />
          {trip.patient?.phone}
        </div>
        <div className="flex items-center gap-3 text-sm font-medium text-slate-600 truncate">
          <Envelope
            weight="duotone"
            className="w-5 h-5 text-slate-400 shrink-0"
          />
          <span className="truncate">{trip.patient?.email}</span>
        </div>
      </div>
    </div>
  );
}

interface DriverProfileCardProps {
  trip: Trip;
  canManage: boolean;
  onAssignDriver: (tripId: string) => void;
}

export function DriverProfileCard({ 
  trip, 
  canManage, 
  onAssignDriver 
}: DriverProfileCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
      <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-6">
        Assigned Driver
      </h3>
      {trip.driver ? (
        <>
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center">
              <Car
                weight="duotone"
                className="text-emerald-600 w-6 h-6"
              />
            </div>
            <div>
              <p className="font-bold text-slate-900">
                {trip.driver?.full_name}
              </p>
              <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mt-0.5">
                Vehicle: {trip.driver?.vehicle_info || "SEDAN"}
              </p>
            </div>
          </div>
          <div className="space-y-4 pt-6 border-t border-slate-50">
            <div className="flex items-center gap-3 text-sm font-medium text-slate-600">
              <Phone
                weight="duotone"
                className="w-5 h-5 text-slate-400"
              />
              {trip.driver?.phone || "Not available"}
            </div>
          </div>
        </>
      ) : (
        <div className="text-center py-8">
          <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center mx-auto mb-4">
            <Car weight="duotone" className="text-slate-300 w-6 h-6" />
          </div>
          <p className="text-sm font-bold text-slate-400">
            No driver assigned yet
          </p>
          {canManage && (
            <Button
              variant="link"
              className="text-xs text-blue-600 font-bold p-0 h-auto mt-2"
              onClick={() => onAssignDriver(trip.id)}
            >
              Assign Now
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
