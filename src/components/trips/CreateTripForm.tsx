import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  User,
  Car,
  MapPin,
  Calendar,
  Clock,
  Clipboard,
  AlertCircle,
  Plus,
  ArrowRightLeft,
  Trash2,
  CheckCircle2,
} from "lucide-react";
import type { TripStatus } from "./types";
import { cn } from "@/lib/utils";

// --- Time Picker Component ---
// Helper to parse "HH:mm" -> { hour, minute, period }
const parseTime = (timeStr: string) => {
  if (!timeStr) return { hour: "12", minute: "00", period: "AM" };
  const [h, m] = timeStr.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return {
    hour: hour.toString().padStart(2, "0"),
    minute: m.toString().padStart(2, "0"),
    period,
  };
};

// Helper to format { hour, minute, period } -> "HH:mm"
const formatTime = (hour: string, minute: string, period: string) => {
  let h = parseInt(hour, 10);
  if (period === "PM" && h !== 12) h += 12;
  if (period === "AM" && h === 12) h = 0;
  return `${h.toString().padStart(2, "0")}:${minute}`;
};

const TimePicker = ({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (val: string) => void;
  className?: string;
}) => {
  const { hour, minute, period } = useMemo(() => parseTime(value), [value]);

  const updateTime = (
    newHour: string,
    newMinute: string,
    newPeriod: string
  ) => {
    onChange(formatTime(newHour, newMinute, newPeriod));
  };

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <select
        value={hour}
        onChange={(e) => updateTime(e.target.value, minute, period)}
        className="flex-1 rounded-md border-slate-200 bg-white h-10 px-2 text-sm focus:ring-2 focus:ring-blue-500/20"
      >
        {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
          <option key={h} value={h.toString().padStart(2, "0")}>
            {h.toString().padStart(2, "0")}
          </option>
        ))}
      </select>
      <span className="text-slate-400 font-bold">:</span>
      <select
        value={minute}
        onChange={(e) => updateTime(hour, e.target.value, period)}
        className="flex-1 rounded-md border-slate-200 bg-white h-10 px-2 text-sm focus:ring-2 focus:ring-blue-500/20"
      >
        {/* 5 minute steps */}
        {Array.from({ length: 12 }, (_, i) => i * 5).map((m) => (
          <option key={m} value={m.toString().padStart(2, "0")}>
            {m.toString().padStart(2, "0")}
          </option>
        ))}
      </select>
      <select
        value={period}
        onChange={(e) => updateTime(hour, minute, e.target.value)}
        className="w-20 rounded-md border-slate-200 bg-white h-10 px-2 text-sm focus:ring-2 focus:ring-blue-500/20"
      >
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
    </div>
  );
};

// Trip type options (purpose-based)
const TRIP_TYPES = [
  { value: "WORK", label: "Work" },
  { value: "SCHOOL", label: "School" },
  { value: "PLEASURE", label: "Pleasure" },
  { value: "DENTIST", label: "Dentist" },
  { value: "MEDICAL APPOINTMENT", label: "Medical Appointment" },
  { value: "CLINICS", label: "Clinics" },
  { value: "METHADONE CLINICS", label: "Methadone Clinics" },
  { value: "DIALYSIS", label: "Dialysis" },
  { value: "REGULAR TRANSPORTATION", label: "Regular Transportation" },
  { value: "OTHER", label: "Other" },
] as const;

// Vehicle type compatibility matrix
const canDriverServePatient = (
  driverVehicleType: string | null,
  patientNeed: string | null
): boolean => {
  if (!patientNeed || patientNeed === "COMMON CARRIER") return true;
  if (!driverVehicleType) return false;

  const compatibility: Record<string, string[]> = {
    "COMMON CARRIER": ["COMMON CARRIER"],
    "FOLDED WHEELCHAIR": ["COMMON CARRIER", "FOLDED WHEELCHAIR"],
    WHEELCHAIR: ["COMMON CARRIER", "FOLDED WHEELCHAIR", "WHEELCHAIR"],
    VAN: ["COMMON CARRIER", "FOLDED WHEELCHAIR", "WHEELCHAIR", "VAN"],
  };

  return compatibility[driverVehicleType]?.includes(patientNeed) || false;
};

interface TripDraft {
  id: string; // Temporary ID for UI handling
  db_id?: string; // Actual Database ID if editing an existing trip
  patient_id: string;
  driver_id: string;
  pickup_location: string;
  dropoff_location: string;
  pickup_date: string;
  pickup_time: string;
  trip_type: string;
  other_trip_type: string;
  notes: string;
  status: TripStatus;
}

interface CreateTripFormProps {
  onSuccess: () => void;
  onCancel: () => void;
  onLoadingChange?: (loading: boolean) => void;
  tripId?: string;
}

export function CreateTripForm({
  onSuccess,
  onLoadingChange,
  tripId, // If provided, we are in "Edit Mode" (for at least the primary trip)
}: CreateTripFormProps) {
  const { currentOrganization } = useOrganization();
  const queryClient = useQueryClient();
  const [activeLegId, setActiveLegId] = useState<string>("leg-1");
  const [conflictError, setConflictError] = useState<string | null>(null);

  // Initial state for a fresh form
  const createEmptyLeg = (id: string = `leg-${Date.now()}`): TripDraft => ({
    id,
    patient_id: "",
    driver_id: "",
    pickup_location: "",
    dropoff_location: "",
    pickup_date: new Date().toISOString().split("T")[0],
    pickup_time: "",
    trip_type: "MEDICAL APPOINTMENT",
    other_trip_type: "",
    notes: "",
    status: "pending",
  });

  const [tripLegs, setTripLegs] = useState<TripDraft[]>([
    createEmptyLeg("leg-1"),
  ]);

  // Helper to update the currently active leg
  const updateActiveLeg = (updates: Partial<TripDraft>) => {
    setTripLegs((prev) =>
      prev.map((leg) => (leg.id === activeLegId ? { ...leg, ...updates } : leg))
    );
  };

  // Helper to get the current leg data safely
  const currentLeg = tripLegs.find((l) => l.id === activeLegId) || tripLegs[0];

  // Fetch existing trip if editing
  const { data: existingTrip, isLoading: isLoadingTrip } = useQuery({
    queryKey: ["trip-form", tripId],
    queryFn: async () => {
      if (!tripId) return null;
      const { data, error } = await supabase
        .from("trips")
        .select("*")
        .eq("id", tripId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!tripId,
  });

  useEffect(() => {
    if (existingTrip && existingTrip.pickup_time) {
      const date = new Date(existingTrip.pickup_time);
      if (!isNaN(date.getTime())) {
        const initialLeg: TripDraft = {
          id: "leg-1",
          db_id: existingTrip.id, // Track that this leg corresponds to an existing DB record
          patient_id: existingTrip.patient_id,
          driver_id: existingTrip.driver_id || "",
          pickup_location: existingTrip.pickup_location || "",
          dropoff_location: existingTrip.dropoff_location || "",
          pickup_date: date.toISOString().split("T")[0],
          pickup_time: date.toTimeString().split(" ")[0].substring(0, 5),
          trip_type: TRIP_TYPES.some((t) => t.value === existingTrip.trip_type)
            ? existingTrip.trip_type
            : "OTHER",
          other_trip_type: TRIP_TYPES.some(
            (t) => t.value === existingTrip.trip_type
          )
            ? ""
            : existingTrip.trip_type || "",
          notes: existingTrip.notes || "",
          status: existingTrip.status || "pending",
        };
        setTripLegs([initialLeg]);
        setActiveLegId("leg-1");
      }
    }
  }, [existingTrip]);

  const { data: patients } = useQuery({
    queryKey: ["patients-form", currentOrganization?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patients")
        .select("id, full_name, vehicle_type_need")
        .eq("org_id", currentOrganization?.id)
        .order("full_name");
      if (error) throw error;
      return data;
    },
    enabled: !!currentOrganization,
  });

  const { data: drivers } = useQuery({
    queryKey: ["drivers-form", currentOrganization?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("drivers")
        .select("id, full_name, email, phone, vehicle_type")
        .eq("org_id", currentOrganization?.id)
        .order("full_name");
      if (error) throw error;
      return data;
    },
    enabled: !!currentOrganization,
  });

  const { data: employees } = useQuery({
    queryKey: ["employees-form", currentOrganization?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, full_name, email, phone")
        .eq("org_id", currentOrganization?.id)
        .order("full_name");
      if (error) throw error;
      return data;
    },
    enabled: !!currentOrganization,
  });

  const allPotentialDrivers = useMemo(
    () =>
      [
        ...(drivers || []).map((d) => ({ ...d, type: "driver" as const })),
        ...(employees || [])
          .filter((e) => !(drivers || []).some((d) => d.email === e.email))
          .map((e) => ({
            ...e,
            type: "employee" as const,
            vehicle_type: null as string | null,
          })),
      ].sort((a, b) => (a.full_name || "").localeCompare(b.full_name || "")),
    [drivers, employees]
  );

  // Derived state for the current leg
  const selectedPatient = patients?.find((p) => p.id === currentLeg.patient_id);
  const patientVehicleNeed = selectedPatient?.vehicle_type_need || null;

  const compatibleDrivers = useMemo(() => {
    if (!patientVehicleNeed) return allPotentialDrivers;
    return allPotentialDrivers.filter((d) =>
      canDriverServePatient(d.vehicle_type, patientVehicleNeed)
    );
  }, [allPotentialDrivers, patientVehicleNeed]);

  const addReturnTrip = () => {
    const lastLeg = tripLegs[tripLegs.length - 1];
    const newLeg = createEmptyLeg();

    // Auto-fill return details
    newLeg.patient_id = lastLeg.patient_id;
    newLeg.pickup_location = lastLeg.dropoff_location;
    newLeg.dropoff_location = lastLeg.pickup_location;
    newLeg.pickup_date = lastLeg.pickup_date;
    newLeg.trip_type = lastLeg.trip_type; // Usually return trip has same billing type

    setTripLegs([...tripLegs, newLeg]);
    setActiveLegId(newLeg.id);
  };

  const addNextLeg = () => {
    const lastLeg = tripLegs[tripLegs.length - 1];
    const newLeg = createEmptyLeg();

    // Auto-fill continuation details
    newLeg.patient_id = lastLeg.patient_id;
    newLeg.pickup_location = lastLeg.dropoff_location; // Start where we left off
    newLeg.pickup_date = lastLeg.pickup_date;

    setTripLegs([...tripLegs, newLeg]);
    setActiveLegId(newLeg.id);
  };

  const removeLeg = (id: string) => {
    if (tripLegs.length <= 1) return;
    const newLegs = tripLegs.filter((l) => l.id !== id);
    setTripLegs(newLegs);
    if (activeLegId === id) {
      setActiveLegId(newLegs[newLegs.length - 1].id);
    }
  };

  const toggleLoading = (val: boolean) => {
    onLoadingChange?.(val);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrganization) return;
    setConflictError(null);
    toggleLoading(true);

    try {
      // Validate all legs have time and locations
      const invalidLeg = tripLegs.find(
        (l) => !l.pickup_time || !l.pickup_location || !l.dropoff_location
      );
      if (invalidLeg) {
        setConflictError(
          "Please check the trip info, there's seems a conflict."
        );
        setActiveLegId(invalidLeg.id);
        toggleLoading(false);
        return;
      }

      // Check for conflicts
      for (const leg of tripLegs) {
        const pickupDateTime = `${leg.pickup_date}T${leg.pickup_time}:00`;

        // Check Patient Conflict
        const { data: patientConflicts } = await supabase
          .from("trips")
          .select("id, pickup_time")
          .eq("patient_id", leg.patient_id)
          .eq("pickup_time", pickupDateTime)
          .not("status", "in", '("cancelled")') // Explicit syntax for checking not in list if needed, or just neq cancelled
          .neq("status", "cancelled")
          .neq("status", "no_show");

        if (patientConflicts && patientConflicts.length > 0) {
          // Filter out self if editing
          const realConflicts = patientConflicts.filter(
            (c) => c.id !== leg.db_id && c.id !== tripId
          );
          if (realConflicts.length > 0) {
            const patientName =
              patients?.find((p) => p.id === leg.patient_id)?.full_name ||
              "Patient";
            setConflictError(
              `Conflict detected: ${patientName} already has a trip at ${
                parseTime(leg.pickup_time).hour
              }:${parseTime(leg.pickup_time).minute} ${
                parseTime(leg.pickup_time).period
              } on this date.`
            );
            setActiveLegId(leg.id);
            toggleLoading(false);
            return;
          }
        }

        // Check Driver Conflict
        if (leg.driver_id) {
          const { data: driverConflicts } = await supabase
            .from("trips")
            .select("id")
            .eq("driver_id", leg.driver_id)
            .eq("pickup_time", pickupDateTime)
            .neq("status", "cancelled")
            .neq("status", "no_show");

          if (driverConflicts && driverConflicts.length > 0) {
            const realDriverConflicts = driverConflicts.filter(
              (c) => c.id !== leg.db_id && c.id !== tripId
            );
            if (realDriverConflicts.length > 0) {
              const driverName =
                allPotentialDrivers.find((d) => d.id === leg.driver_id)
                  ?.full_name || "Driver";
              setConflictError(
                `Conflict detected: Driver ${driverName} is already assigned to a trip at ${
                  parseTime(leg.pickup_time).hour
                }:${parseTime(leg.pickup_time).minute} ${
                  parseTime(leg.pickup_time).period
                } on this date.`
              );
              setActiveLegId(leg.id);
              toggleLoading(false);
              return;
            }
          }
        }
      }

      // Process each leg
      for (const leg of tripLegs) {
        const pickupDateTime = new Date(
          `${leg.pickup_date}T${leg.pickup_time}`
        );

        let finalDriverId = leg.driver_id;

        // Check/Create driver logic (same as before)
        if (finalDriverId) {
          const selectedEntity = allPotentialDrivers.find(
            (p) => p.id === finalDriverId
          );
          if (selectedEntity && selectedEntity.type === "employee") {
            const { data: existingDriver } = await supabase
              .from("drivers")
              .select("id")
              .eq("email", selectedEntity.email)
              .single();

            if (existingDriver) {
              finalDriverId = existingDriver.id;
            } else {
              const { data: newDriver, error: driverError } = await supabase
                .from("drivers")
                .insert({
                  org_id: currentOrganization.id,
                  full_name: selectedEntity.full_name,
                  email: selectedEntity.email,
                  phone: selectedEntity.phone,
                  active: true,
                })
                .select()
                .single();
              if (driverError) throw driverError;
              finalDriverId = newDriver.id;
            }
          }
        }

        const payload = {
          org_id: currentOrganization.id,
          patient_id: leg.patient_id,
          driver_id: finalDriverId || null,
          pickup_location: leg.pickup_location,
          dropoff_location: leg.dropoff_location,
          pickup_time: pickupDateTime.toISOString(),
          trip_type:
            leg.trip_type === "OTHER" ? leg.other_trip_type : leg.trip_type,
          notes: leg.notes,
          status:
            leg.status === "pending" && finalDriverId ? "assigned" : leg.status,
        };

        if (leg.db_id) {
          // Edit mode: update specific known record
          const { error } = await supabase
            .from("trips")
            .update(payload)
            .eq("id", leg.db_id);
          if (error) throw error;
        } else {
          // Create mode: inserting new trip(s)
          const { error } = await supabase.from("trips").insert(payload);
          if (error) throw error;
        }
      }

      // Invalidate queries
      if (tripId) {
        queryClient.invalidateQueries({ queryKey: ["trip", tripId] });
      }
      await queryClient.invalidateQueries({ queryKey: ["trips"] });

      onSuccess();
    } catch (error) {
      console.error("Error saving trip:", error);
      setConflictError("Failed to save trip(s). Please try again.");
    } finally {
      toggleLoading(false);
    }
  };

  if (isLoadingTrip) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-[80vh] lg:h-auto overflow-hidden">
      {/* Sidebar: Trip Legs Timeline */}
      {!tripId && (
        <div className="w-full lg:w-1/3 bg-slate-50 border border-slate-200 rounded-xl overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-200 bg-slate-100/50">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
              <Clipboard className="w-4 h-4 text-slate-500" />
              Trip Itinerary
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              {tripLegs.length} trip{tripLegs.length !== 1 ? "s" : ""} scheduled
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {tripLegs.map((leg, index) => {
              const isValid =
                leg.patient_id &&
                leg.pickup_location &&
                leg.dropoff_location &&
                leg.pickup_time;
              return (
                <div
                  key={leg.id}
                  onClick={() => setActiveLegId(leg.id)}
                  className={cn(
                    "relative pl-6 pb-6 cursor-pointer group transition-all",
                    index === tripLegs.length - 1 ? "pb-0" : "" // No padding needed for last line if purely visual, but gap handles it
                  )}
                >
                  {/* Timeline Line */}
                  {index !== tripLegs.length - 1 && (
                    <div className="absolute left-[11px] top-6 bottom-0 w-0.5 bg-slate-200 group-hover:bg-blue-100 transition-colors" />
                  )}

                  {/* Dot */}
                  <div
                    className={cn(
                      "absolute left-0 top-1 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors shadow-sm z-10",
                      activeLegId === leg.id
                        ? "bg-blue-600 border-blue-600 text-white"
                        : isValid
                        ? "bg-white border-emerald-400 text-emerald-500"
                        : "bg-white border-slate-300 text-slate-300 group-hover:border-blue-300"
                    )}
                  >
                    {isValid ? (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    ) : (
                      <div className="w-2 h-2 rounded-full bg-current" />
                    )}
                  </div>

                  {/* Card content */}
                  <div
                    className={cn(
                      "rounded-lg border p-3 text-sm transition-all",
                      activeLegId === leg.id
                        ? "bg-white border-blue-200 shadow-md ring-1 ring-blue-100"
                        : "bg-white border-slate-200 hover:border-blue-200 hover:shadow-sm"
                    )}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-bold text-slate-700">
                        Trip {index + 1}
                      </span>
                      {tripLegs.length > 1 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeLeg(leg.id);
                          }}
                          className="text-slate-400 hover:text-red-500 p-1"
                          type="button"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 text-slate-600">
                        <Clock className="w-3.5 h-3.5 text-blue-500" />
                        <span
                          className={
                            !leg.pickup_time
                              ? "text-slate-400 italic"
                              : "font-medium"
                          }
                        >
                          {leg.pickup_time || "Select time"}
                        </span>
                      </div>
                      <div className="flex items-start gap-2 text-slate-600">
                        <MapPin className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                        <span
                          className={cn(
                            "line-clamp-1",
                            !leg.pickup_location && "text-slate-400 italic"
                          )}
                        >
                          {leg.pickup_location || "Origin"}
                        </span>
                      </div>
                      <div className="flex items-start gap-2 text-slate-600">
                        <MapPin className="w-3.5 h-3.5 text-green-500 shrink-0 mt-0.5" />
                        <span
                          className={cn(
                            "line-clamp-1",
                            !leg.dropoff_location && "text-slate-400 italic"
                          )}
                        >
                          {leg.dropoff_location || "Destination"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="p-4 border-t border-slate-200 bg-white grid grid-cols-2 gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addReturnTrip}
              className="w-full text-xs"
            >
              <ArrowRightLeft className="w-3.5 h-3.5 mr-2" />
              Return Trip
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addNextLeg}
              className="w-full text-xs"
            >
              <Plus className="w-3.5 h-3.5 mr-2" />
              Add Leg
            </Button>
          </div>
        </div>
      )}

      {/* Main Form Area */}
      <div className="flex-1 overflow-y-auto pr-1">
        <form
          id="create-trip-form"
          onSubmit={handleSubmit}
          className="space-y-5"
        >
          {/* Patient & Driver Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg border border-slate-100">
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-slate-700 font-medium text-sm">
                <User className="w-4 h-4 text-blue-500" />
                Patient Information
              </Label>
              <select
                required
                value={currentLeg.patient_id}
                onChange={(e) => {
                  // If this is the only leg, just update it
                  // If there are multiple legs, ask user? Or just update current.
                  // Ideally, changing patient on Leg 1 might want to propagate to others if they are empty
                  const newPatientId = e.target.value;

                  // Helper to update all legs if they were empty or same as old value
                  // But simpler: Just update current leg.
                  // NOTE: If creating a multi-leg trip, usually for SAME patient.
                  // Let's enforce SAME patient for all legs for now to avoid complexity?
                  // No, let's keep it flexible but default to same.
                  updateActiveLeg({ patient_id: newPatientId });
                }}
                className="w-full rounded-md border-slate-200 bg-white h-10 px-3 text-sm focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="">Select Patient</option>
                {patients?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-slate-700 font-medium text-sm">
                <Car className="w-4 h-4 text-emerald-500" />
                Assign Driver (Optional)
              </Label>
              {patientVehicleNeed && compatibleDrivers.length === 0 && (
                <div className="flex items-center gap-2 text-amber-600 text-sm bg-amber-50 p-2 rounded-lg">
                  <AlertCircle className="w-4 h-4" />
                  No drivers available for {patientVehicleNeed} needs
                </div>
              )}
              <select
                value={currentLeg.driver_id}
                onChange={(e) => updateActiveLeg({ driver_id: e.target.value })}
                className="w-full rounded-md border-slate-200 bg-white h-10 px-3 text-sm focus:ring-2 focus:ring-emerald-500/20"
              >
                <option value="">Unassigned</option>
                {compatibleDrivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.full_name}
                    {d.vehicle_type
                      ? ` (${d.vehicle_type.replace("_", " ")})`
                      : ""}
                    {d.type === "employee" ? " - Staff" : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Locations Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Trip Details{" "}
                {tripLegs.length > 1
                  ? `(Trip ${
                      tripLegs.findIndex((l) => l.id === activeLegId) + 1
                    })`
                  : ""}
              </h3>
              {tripLegs.length > 1 && (
                <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                  Editing Trip{" "}
                  {tripLegs.findIndex((l) => l.id === activeLegId) + 1} of{" "}
                  {tripLegs.length}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-red-500" />
                  Pickup Location
                </Label>
                <Input
                  required
                  placeholder="Enter full address"
                  value={currentLeg.pickup_location}
                  onChange={(e) =>
                    updateActiveLeg({ pickup_location: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-slate-500" />
                  Dropoff Location
                </Label>
                <Input
                  required
                  placeholder="Enter full address"
                  value={currentLeg.dropoff_location}
                  onChange={(e) =>
                    updateActiveLeg({ dropoff_location: e.target.value })
                  }
                />
              </div>
            </div>
          </div>

          {/* Schedule Section */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-500" />
                Date
              </Label>
              <Input
                required
                type="date"
                value={currentLeg.pickup_date}
                onChange={(e) =>
                  updateActiveLeg({ pickup_date: e.target.value })
                }
                className="bg-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-500" />
                Time
              </Label>
              <TimePicker
                value={currentLeg.pickup_time}
                onChange={(t) => updateActiveLeg({ pickup_time: t })}
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Clipboard className="w-4 h-4 text-slate-500" />
                Trip Type
              </Label>
              <select
                value={currentLeg.trip_type}
                onChange={(e) => updateActiveLeg({ trip_type: e.target.value })}
                className="w-full rounded-md border-slate-200 bg-white h-10 px-3 text-sm"
              >
                {TRIP_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
              {currentLeg.trip_type === "OTHER" && (
                <div className="mt-2 animate-in fade-in slide-in-from-top-2 duration-200">
                  <Input
                    placeholder="Please specify trip type"
                    value={currentLeg.other_trip_type}
                    onChange={(e) =>
                      updateActiveLeg({ other_trip_type: e.target.value })
                    }
                    className="h-10"
                  />
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Clipboard className="w-4 h-4 text-slate-500" />
                Status
              </Label>
              <select
                value={currentLeg.status}
                onChange={(e) =>
                  updateActiveLeg({ status: e.target.value as TripStatus })
                }
                className="w-full rounded-md border-slate-200 bg-white h-10 px-3 text-sm"
              >
                <option value="pending">Pending</option>
                <option value="assigned" disabled={!currentLeg.driver_id}>
                  Assigned
                </option>
                <option value="accepted">Accepted</option>
                <option value="arrived">Arrived</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
                <option value="no_show">No Show</option>
              </select>
            </div>
          </div>

          {/* Notes Section */}
          <div className="space-y-2">
            <Label>Special Instructions / Notes</Label>
            <Textarea
              placeholder="Add any specific details for the driver or trip..."
              className="min-h-[80px] text-sm"
              value={currentLeg.notes}
              onChange={(e) => updateActiveLeg({ notes: e.target.value })}
            />
          </div>

          {/* Conflict / Error Message Area */}
          {conflictError && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg animate-in fade-in slide-in-from-bottom-2">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-red-900 text-sm">
                    Unable to Schedule Trip
                  </h4>
                  <p className="text-sm text-red-700 mt-1">{conflictError}</p>
                </div>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
