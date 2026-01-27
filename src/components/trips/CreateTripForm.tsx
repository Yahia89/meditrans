import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useAuth } from "@/contexts/auth-context";
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
import {
  calculateCreditStatus,
  ESTIMATED_COST_PER_TRIP,
} from "@/lib/credit-utils";

import { TimePicker, TRIP_TYPES } from "./trip-utils";

import { useLoadScript } from "@react-google-maps/api";
import { AddressAutocomplete } from "./AddressAutocomplete";

// Libraries must be defined outside component to avoid re-loading
const GOOGLE_MAPS_LIBRARIES: (
  | "places"
  | "geometry"
  | "drawing"
  | "visualization"
)[] = ["places"];

// Vehicle type compatibility matrix
const canDriverServePatient = (
  driverVehicleType: string | null,
  patientNeed: string | null,
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
  distance_miles?: number | null;
  duration_minutes?: number | null;
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
  // Load Google Maps API
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "",
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  const { currentOrganization } = useOrganization();
  const { user, profile } = useAuth();
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
    distance_miles: null,
    duration_minutes: null,
  });

  const [tripLegs, setTripLegs] = useState<TripDraft[]>([
    createEmptyLeg("leg-1"),
  ]);

  // Helper to update the currently active leg
  const updateActiveLeg = (updates: Partial<TripDraft>) => {
    setTripLegs((prev) =>
      prev.map((leg) =>
        leg.id === activeLegId ? { ...leg, ...updates } : leg,
      ),
    );
  };

  // Helper to get the current leg data safely
  const currentLeg = tripLegs.find((l) => l.id === activeLegId) || tripLegs[0];

  // Calculate route metrics
  const calculateRoute = async (pickup: string, dropoff: string) => {
    if (!pickup || !dropoff || !isLoaded) return null;

    try {
      const directionsService = new google.maps.DirectionsService();
      const result = await directionsService.route({
        origin: pickup,
        destination: dropoff,
        travelMode: google.maps.TravelMode.DRIVING,
      });

      if (result.routes[0]?.legs[0]) {
        const leg = result.routes[0].legs[0];
        const distanceMeters = leg.distance?.value || 0;
        const durationSeconds = leg.duration?.value || 0;

        return {
          distance_miles: Math.ceil(distanceMeters * 0.000621371),
          duration_minutes: Math.ceil(durationSeconds / 60),
        };
      }
    } catch (error) {
      console.error("Error calculating route:", error);
    }
    return null;
  };

  const handleLocationSelect = async (
    field: "pickup_location" | "dropoff_location",
    value: string,
  ) => {
    if (!value) {
      // Manual clear or typing
      updateActiveLeg({
        [field]: value,
        distance_miles: null,
        duration_minutes: null,
      });
      return;
    }

    // Update the field immediately
    updateActiveLeg({ [field]: value });

    // Get the other field's current value
    const otherValue =
      field === "pickup_location"
        ? currentLeg.dropoff_location
        : currentLeg.pickup_location;

    // If we have both addresses, calculate the route
    if (value && otherValue) {
      const pickup = field === "pickup_location" ? value : otherValue;
      const dropoff = field === "dropoff_location" ? value : otherValue;

      const metrics = await calculateRoute(pickup, dropoff);
      if (metrics) {
        // Update with the calculated metrics
        setTripLegs((prev) =>
          prev.map((leg) =>
            leg.id === activeLegId
              ? {
                  ...leg,
                  distance_miles: metrics.distance_miles,
                  duration_minutes: metrics.duration_minutes,
                }
              : leg,
          ),
        );
      }
    }
  };

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
            (t) => t.value === existingTrip.trip_type,
          )
            ? ""
            : existingTrip.trip_type || "",
          notes: existingTrip.notes || "",
          status: existingTrip.status || "pending",
          distance_miles: existingTrip.distance_miles,
          duration_minutes: existingTrip.duration_minutes,
        };
        setTripLegs([initialLeg]);
        setActiveLegId("leg-1");
      }
    }
  }, [existingTrip]);

  const { data: patientsData } = useQuery({
    queryKey: ["patients-form-with-credits", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];

      // 1. Fetch patients
      const { data: patients, error: patientsError } = await supabase
        .from("patients")
        .select("id, full_name, vehicle_type_need, monthly_credit")
        .eq("org_id", currentOrganization.id)
        .order("full_name");

      if (patientsError) throw patientsError;

      // 2. Fetch completed trip counts for this month
      const now = new Date();
      const startOfMonth = new Date(
        now.getFullYear(),
        now.getMonth(),
        1,
      ).toISOString();
      const endOfMonth = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0,
        23,
        59,
        59,
      ).toISOString();

      const { data: tripCounts, error: tripsError } = await supabase
        .from("trips")
        .select("patient_id")
        .eq("org_id", currentOrganization.id)
        .eq("status", "completed")
        .gte("pickup_time", startOfMonth)
        .lte("pickup_time", endOfMonth);

      if (tripsError) throw tripsError;

      // 3. Map status to patients
      return patients.map((p) => {
        const completedCount =
          tripCounts?.filter((t) => t.patient_id === p.id).length || 0;
        const creditInfo = calculateCreditStatus(
          p.monthly_credit,
          completedCount * ESTIMATED_COST_PER_TRIP,
        );
        return {
          ...p,
          creditInfo,
        };
      });
    },
    enabled: !!currentOrganization,
  });

  const patients = patientsData;

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

  const allPotentialDrivers = useMemo(
    () =>
      (drivers || [])
        .map((d) => ({ ...d, type: "driver" as const }))
        .sort((a, b) => (a.full_name || "").localeCompare(b.full_name || "")),
    [drivers],
  );

  // Derived state for the current leg
  const selectedPatient = patients?.find((p) => p.id === currentLeg.patient_id);
  const patientVehicleNeed = selectedPatient?.vehicle_type_need || null;

  const compatibleDrivers = useMemo(() => {
    if (!patientVehicleNeed) return allPotentialDrivers;
    return allPotentialDrivers.filter((d) =>
      canDriverServePatient(d.vehicle_type, patientVehicleNeed),
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
      const invalidLeg = tripLegs.find((l) => {
        const isWillCall = l.trip_type === "WILL CALL";
        // For WILL CALL, pickup_time is optional
        if (isWillCall) {
          return !l.pickup_location || !l.dropoff_location;
        }
        return !l.pickup_time || !l.pickup_location || !l.dropoff_location;
      });
      if (invalidLeg) {
        setConflictError(
          "Missing trip details. Please ensure pickup time, origin, and destination are all set.",
        );
        setActiveLegId(invalidLeg.id);
        toggleLoading(false);
        return;
      }

      // Check for conflicts
      for (const leg of tripLegs) {
        // Create a proper Date object and get ISO string for consistent DB comparison
        // Default to 00:00 for Will Call if time is missing
        const timeToUse =
          !leg.pickup_time && leg.trip_type === "WILL CALL"
            ? "00:00"
            : leg.pickup_time;

        const pickupDateTimeUTC = new Date(
          `${leg.pickup_date}T${timeToUse}`,
        ).toISOString();

        // Check Patient Conflict
        const { data: patientConflicts } = await supabase
          .from("trips")
          .select("id, pickup_time")
          .eq("patient_id", leg.patient_id)
          .eq("pickup_time", pickupDateTimeUTC)
          .not("status", "in", '("cancelled", "no_show")');

        if (patientConflicts && patientConflicts.length > 0) {
          // Filter out self and the primary trip being edited
          const realConflicts = patientConflicts.filter(
            (c) => c.id !== leg.db_id && c.id !== tripId,
          );
          if (realConflicts.length > 0) {
            const patientName =
              patients?.find((p) => p.id === leg.patient_id)?.full_name ||
              "Patient";

            setConflictError(
              `Unable to Schedule: ${patientName} already has another trip scheduled at this exact time.`,
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
            .select("id, patient_id, patients(full_name)")
            .eq("driver_id", leg.driver_id)
            .eq("pickup_time", pickupDateTimeUTC)
            .not("status", "in", '("cancelled", "no_show")');

          if (driverConflicts && driverConflicts.length > 0) {
            const realDriverConflicts = driverConflicts.filter(
              (c) =>
                c.id !== leg.db_id &&
                c.id !== tripId &&
                c.patient_id !== leg.patient_id, // ALLOW if same patient (multi-leg sequence)
            );

            if (realDriverConflicts.length > 0) {
              const driverName =
                allPotentialDrivers.find((d) => d.id === leg.driver_id)
                  ?.full_name || "Driver";

              // Get the names of other patients for the conflict message
              const otherPatientNames = realDriverConflicts
                .map((c: any) => c.patients?.full_name || "another patient")
                .join(", ");

              setConflictError(
                `Driver Conflict: ${driverName} is already assigned to a trip for ${otherPatientNames} at this time.`,
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
        const timeToUse =
          !leg.pickup_time && leg.trip_type === "WILL CALL"
            ? "00:00"
            : leg.pickup_time;

        const pickupDateTime = new Date(`${leg.pickup_date}T${timeToUse}`);

        const finalDriverId = leg.driver_id;
        // Logic for employee -> driver conversion removed. Driver must be selected from drivers list.

        // Determine final status
        let finalStatus = leg.status;
        if (leg.db_id && existingTrip) {
          // Logic for existing trips (edit mode)
          if (existingTrip.status === "assigned" && !finalDriverId) {
            finalStatus = "pending"; // Revert to pending if driver removed
          } else if (existingTrip.status === "pending" && finalDriverId) {
            finalStatus = "assigned"; // Auto-assign if driver added
          }
        } else {
          // Logic for new trips (create mode)
          if (finalStatus === "pending" && finalDriverId) {
            finalStatus = "assigned";
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
          status: finalStatus,
          distance_miles: leg.distance_miles,
          duration_minutes: leg.duration_minutes,
        };

        if (leg.db_id) {
          // Edit mode: determine what exactly changed for history
          const changes: string[] = [];
          if (existingTrip) {
            if (existingTrip.pickup_time !== payload.pickup_time)
              changes.push("Time");
            if (existingTrip.pickup_location !== payload.pickup_location)
              changes.push("Pickup Location");
            if (existingTrip.dropoff_location !== payload.dropoff_location)
              changes.push("Dropoff Location");
            if (existingTrip.driver_id !== payload.driver_id) {
              if (!payload.driver_id) {
                changes.push("Unassigned Driver");
              } else {
                const driverName =
                  allPotentialDrivers.find((d) => d.id === payload.driver_id)
                    ?.full_name || "Driver";
                changes.push(`Assigned to ${driverName}`);
              }
            }
            if (existingTrip.notes !== payload.notes) changes.push("Notes");
            if (existingTrip.distance_miles !== payload.distance_miles) {
              changes.push(`Distance: ${payload.distance_miles} miles`);
            }
          }

          const { error } = await supabase
            .from("trips")
            .update(payload)
            .eq("id", leg.db_id);
          if (error) throw error;

          // Log history with detailed changes
          await supabase.from("trip_status_history").insert({
            trip_id: leg.db_id,
            status:
              changes.length > 0
                ? `UPDATED: ${changes.join(", ")}`
                : "UPDATED (No major changes)",
            actor_id: user?.id,
            actor_name: profile?.full_name || user?.email || "Unknown User",
          });
        } else {
          // Create mode: inserting new trip(s)
          const { data: newTrip, error } = await supabase
            .from("trips")
            .insert(payload)
            .select()
            .single();
          if (error) throw error;

          // Log history
          await supabase.from("trip_status_history").insert({
            trip_id: newTrip.id,
            status: payload.driver_id ? "CREATED AND ASSIGNED" : "TRIP CREATED",
            actor_id: user?.id,
            actor_name: profile?.full_name || user?.email || "Unknown User",
          });
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
                    index === tripLegs.length - 1 ? "pb-0" : "", // No padding needed for last line if purely visual, but gap handles it
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
                          : "bg-white border-slate-300 text-slate-300 group-hover:border-blue-300",
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
                        : "bg-white border-slate-200 hover:border-blue-200 hover:shadow-sm",
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
                            !leg.pickup_location && "text-slate-400 italic",
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
                            !leg.dropoff_location && "text-slate-400 italic",
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
          {/* Google Maps Error Alert */}
          {loadError && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-red-700">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <div>
                <p className="font-bold text-sm">Google Maps failed to load</p>
                <p className="text-xs mt-1">
                  {loadError.message ||
                    "Please check your API key configuration."}
                </p>
              </div>
            </div>
          )}

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
                  const newPatientId = e.target.value;
                  updateActiveLeg({ patient_id: newPatientId });
                }}
                className="w-full rounded-md border-slate-200 bg-white h-10 px-3 text-sm focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="">Select Patient</option>
                {patients?.map((p) => {
                  const hasNoCredit =
                    p.monthly_credit === null ||
                    p.monthly_credit === undefined ||
                    p.monthly_credit === 0;
                  const isLow = p.creditInfo.status === "low";
                  const isDisabled = hasNoCredit || isLow;
                  const pct = p.creditInfo.percentage.toFixed(0);

                  let statusText = "";
                  if (hasNoCredit) {
                    statusText = "- NO CREDITS ASSIGNED";
                  } else if (isLow) {
                    statusText = "- INSUFFICIENT CREDIT";
                  }

                  return (
                    <option
                      key={p.id}
                      value={p.id}
                      disabled={isDisabled}
                      className={cn(
                        isDisabled && "text-slate-400 bg-slate-50",
                        !hasNoCredit && isLow && "text-red-400",
                        p.creditInfo.status === "mid" && "text-amber-600",
                      )}
                    >
                      {p.full_name} {p.monthly_credit ? `(${pct}% credit)` : ""}{" "}
                      {statusText}
                    </option>
                  );
                })}
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
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Locations Section with Autocomplete */}
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
                {isLoaded ? (
                  <AddressAutocomplete
                    isLoaded={isLoaded}
                    placeholder="Enter full address"
                    value={currentLeg.pickup_location}
                    onChange={(value) =>
                      updateActiveLeg({ pickup_location: value })
                    }
                    onAddressSelect={(place) => {
                      const address =
                        place.formatted_address || place.name || "";
                      handleLocationSelect("pickup_location", address);
                    }}
                    className="w-full rounded-md border border-input bg-white h-10 px-3 text-sm focus:ring-2 focus:ring-blue-500/20"
                  />
                ) : (
                  <Input
                    required
                    placeholder="Enter full address"
                    value={currentLeg.pickup_location}
                    onChange={(e) =>
                      handleLocationSelect("pickup_location", e.target.value)
                    }
                  />
                )}
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-slate-500" />
                  Dropoff Location
                </Label>
                {isLoaded ? (
                  <AddressAutocomplete
                    isLoaded={isLoaded}
                    placeholder="Enter full address"
                    value={currentLeg.dropoff_location}
                    onChange={(value) =>
                      updateActiveLeg({ dropoff_location: value })
                    }
                    onAddressSelect={(place) => {
                      const address =
                        place.formatted_address || place.name || "";
                      handleLocationSelect("dropoff_location", address);
                    }}
                    className="w-full rounded-md border border-input bg-white h-10 px-3 text-sm focus:ring-2 focus:ring-blue-500/20"
                  />
                ) : (
                  <Input
                    required
                    placeholder="Enter full address"
                    value={currentLeg.dropoff_location}
                    onChange={(e) =>
                      handleLocationSelect("dropoff_location", e.target.value)
                    }
                  />
                )}
              </div>
            </div>

            {/* Trip Metrics Display */}
            {(currentLeg.distance_miles || currentLeg.duration_minutes) && (
              <div className="flex items-center gap-6 mt-2 bg-blue-50/50 p-3 rounded-lg border border-blue-100 animate-in fade-in slide-in-from-top-2">
                {currentLeg.distance_miles && (
                  <div className="flex items-center gap-2 text-sm text-slate-700">
                    <span className="font-semibold text-blue-600">
                      Est. Distance:
                    </span>
                    {currentLeg.distance_miles} miles
                  </div>
                )}
                {currentLeg.duration_minutes && (
                  <div className="flex items-center gap-2 text-sm text-slate-700">
                    <span className="font-semibold text-blue-600">
                      Est. Duration:
                    </span>
                    {currentLeg.duration_minutes} mins
                  </div>
                )}
              </div>
            )}
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
                disabled={currentLeg.trip_type === "WILL CALL"}
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
