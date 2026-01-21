import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useAuth } from "@/contexts/auth-context";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Plus, MapPin, Clock, Clipboard, Car } from "lucide-react";
import { TimePicker, TRIP_TYPES, canDriverServePatient } from "./trip-utils";
import type { Trip } from "./types";
import { useLoadScript } from "@react-google-maps/api";
import { AddressAutocomplete } from "./AddressAutocomplete";

// Libraries must be defined outside component to avoid re-loading
const GOOGLE_MAPS_LIBRARIES: (
  | "places"
  | "geometry"
  | "drawing"
  | "visualization"
)[] = ["places"];

interface QuickAddLegDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  patientName: string;
  date: Date;
  onSuccess: () => void;
}

export function QuickAddLegDialog({
  open,
  onOpenChange,
  patientId,
  patientName,
  date,
  onSuccess,
}: QuickAddLegDialogProps) {
  const { currentOrganization } = useOrganization();
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load Google Maps Script
  const { isLoaded } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "",
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  // Form State
  const [pickupLocation, setPickupLocation] = useState("");
  const [dropoffLocation, setDropoffLocation] = useState("");
  const [pickupTime, setPickupTime] = useState("");
  const [tripType, setTripType] = useState("MEDICAL APPOINTMENT");
  const [otherTripType, setOtherTripType] = useState("");
  const [notes, setNotes] = useState("");
  const [driverId, setDriverId] = useState("");

  // Fetch existing trips for this patient on this day to pre-fill pickup
  const { data: existingTrips } = useQuery({
    queryKey: ["trips-for-patient-day", patientId, date.toDateString()],
    queryFn: async () => {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      const { data, error } = await supabase
        .from("trips")
        .select("*")
        .eq("patient_id", patientId)
        .gte("pickup_time", startOfDay.toISOString())
        .lte("pickup_time", endOfDay.toISOString())
        .order("pickup_time", { ascending: true });

      if (error) throw error;
      return data as Trip[];
    },
    enabled: open && !!patientId,
  });

  // Pre-fill pickup if we have existing trips
  useMemo(() => {
    if (existingTrips && existingTrips.length > 0 && !pickupLocation) {
      const lastTrip = existingTrips[existingTrips.length - 1];
      setPickupLocation(lastTrip.dropoff_location);
    }
  }, [existingTrips, pickupLocation]);

  // Fetch Drivers
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

  // Fetch Patient Details to check vehicle needs
  const { data: patientDetails } = useQuery({
    queryKey: ["patient-details-form", patientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patients")
        .select("id, vehicle_type_need")
        .eq("id", patientId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!patientId && open,
  });

  const compatibleDrivers = useMemo(() => {
    const need = patientDetails?.vehicle_type_need;
    if (!need) return allPotentialDrivers;
    return allPotentialDrivers.filter((d) =>
      canDriverServePatient(d.vehicle_type, need),
    );
  }, [allPotentialDrivers, patientDetails]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrganization || !user) return;

    if (!pickupTime || !pickupLocation || !dropoffLocation) {
      setError("Please fill in all required fields.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const pickupDateTime = new Date(date);
      const [hours, minutes] = pickupTime.split(":").map(Number);
      pickupDateTime.setHours(hours, minutes, 0, 0);

      const payload = {
        org_id: currentOrganization.id,
        patient_id: patientId,
        driver_id: driverId || null,
        pickup_location: pickupLocation,
        dropoff_location: dropoffLocation,
        pickup_time: pickupDateTime.toISOString(),
        trip_type: tripType === "OTHER" ? otherTripType : tripType,
        notes: notes,
        status: driverId ? "assigned" : "pending",
      };

      const { data: newTrip, error: insertError } = await supabase
        .from("trips")
        .insert(payload)
        .select()
        .single();

      if (insertError) throw insertError;

      // Log History
      await supabase.from("trip_status_history").insert({
        trip_id: newTrip.id,
        status: driverId ? "CREATED AND ASSIGNED" : "TRIP CREATED",
        actor_id: user.id,
        actor_name: profile?.full_name || user.email || "Unknown User",
      });

      queryClient.invalidateQueries({ queryKey: ["trips"] });
      onSuccess();
      onOpenChange(false);
      resetForm();
    } catch (err: any) {
      console.error("Error adding leg:", err);
      setError(err.message || "Failed to add leg.");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setPickupLocation("");
    setDropoffLocation("");
    setPickupTime("");
    setTripType("MEDICAL APPOINTMENT");
    setOtherTripType("");
    setNotes("");
    setDriverId("");
    setError(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-[95vw] max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-2xl border-none shadow-2xl bg-white">
        <DialogHeader className="p-6 pb-4 border-b border-slate-100 bg-white">
          <DialogTitle className="text-xl font-bold text-slate-900">
            Add Leg to Trip
          </DialogTitle>
          <p className="text-sm text-slate-500 mt-1">
            Adding a new transport leg for <strong>{patientName}</strong> on{" "}
            {date.toLocaleDateString()}
          </p>
        </DialogHeader>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col flex-1 overflow-hidden"
        >
          <ScrollArea className="flex-1 overflow-y-auto">
            <div className="p-6 space-y-6">
              {error && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-red-600 text-sm flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                  {error}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Locations */}
                <div className="space-y-4 md:col-span-2">
                  <div className="space-y-2">
                    <Label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-red-500" />
                      Pickup Location
                    </Label>
                    {isLoaded ? (
                      <AddressAutocomplete
                        isLoaded={isLoaded}
                        placeholder="Enter pickup address"
                        value={pickupLocation}
                        onChange={(value) => setPickupLocation(value)}
                        onAddressSelect={(place) => {
                          const address =
                            place.formatted_address || place.name || "";
                          setPickupLocation(address);
                        }}
                        className="w-full rounded-xl border-slate-200 h-11 px-3 text-sm focus:ring-2 focus:ring-emerald-500/20"
                      />
                    ) : (
                      <Input
                        placeholder="Enter pickup address"
                        value={pickupLocation}
                        onChange={(e) => setPickupLocation(e.target.value)}
                        className="rounded-xl border-slate-200 h-11"
                      />
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-emerald-500" />
                      Dropoff Location
                    </Label>
                    {isLoaded ? (
                      <AddressAutocomplete
                        isLoaded={isLoaded}
                        placeholder="Enter destination address"
                        value={dropoffLocation}
                        onChange={(value) => setDropoffLocation(value)}
                        onAddressSelect={(place) => {
                          const address =
                            place.formatted_address || place.name || "";
                          setDropoffLocation(address);
                        }}
                        className="w-full rounded-xl border-slate-200 h-11 px-3 text-sm focus:ring-2 focus:ring-emerald-500/20"
                      />
                    ) : (
                      <Input
                        placeholder="Enter destination address"
                        value={dropoffLocation}
                        onChange={(e) => setDropoffLocation(e.target.value)}
                        className="rounded-xl border-slate-200 h-11"
                      />
                    )}
                  </div>
                </div>

                {/* Time & Type */}
                <div className="space-y-2">
                  <Label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-blue-500" />
                    Pickup Time
                  </Label>
                  <TimePicker value={pickupTime} onChange={setPickupTime} />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <Clipboard className="w-4 h-4 text-orange-500" />
                    Trip Purpose
                  </Label>
                  <select
                    value={tripType}
                    onChange={(e) => setTripType(e.target.value)}
                    className="w-full h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
                  >
                    {TRIP_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                  {tripType === "OTHER" && (
                    <Input
                      placeholder="Specify purpose"
                      value={otherTripType}
                      onChange={(e) => setOtherTripType(e.target.value)}
                      className="mt-2 rounded-xl border-slate-200"
                    />
                  )}
                </div>

                {/* Driver */}
                <div className="space-y-2 md:col-span-2">
                  <Label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <Car className="w-4 h-4 text-indigo-500" />
                    Assign Driver (Optional)
                  </Label>
                  <select
                    value={driverId}
                    onChange={(e) => setDriverId(e.target.value)}
                    className="w-full h-10 rounded-md border border-slate-200 bg-white px-3 text-sm"
                  >
                    <option value="">Unassigned</option>
                    {compatibleDrivers.map((driver) => (
                      <option key={driver.id} value={driver.id}>
                        {driver.full_name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Notes */}
                <div className="space-y-2 md:col-span-2">
                  <Label className="text-sm font-bold text-slate-700">
                    Notes
                  </Label>
                  <Textarea
                    placeholder="Add any specific details for the driver or trip..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="rounded-xl border-slate-200 min-h-[100px] resize-none text-sm"
                  />
                </div>
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="p-6 border-t border-slate-100 bg-white flex items-center justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="rounded-xl h-11 px-6 font-semibold"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-[#3D5A3D] hover:bg-[#2E4A2E] text-white rounded-xl h-11 px-8 font-bold shadow-lg shadow-emerald-900/10"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Adding Leg...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Leg
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
