import { useState, useMemo, useEffect } from "react";
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
import {
  Plus,
  MapPin,
  Clock,
  ClipboardText,
  Car,
  ArrowsLeftRight,
  CircleNotch,
} from "@phosphor-icons/react";
import { TimePicker, TRIP_TYPES } from "./trip-utils";
import type { Trip } from "./types";
import { useLoadScript } from "@react-google-maps/api";
import { AddressAutocomplete } from "./AddressAutocomplete";
import {
  getActiveTimezone,
  parseZonedTime,
  formatInUserTimezone,
} from "@/lib/timezone";
import { TRANSPORT_SERVICE_TYPES } from "@/lib/constants";

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

  const activeTimezone = useMemo(
    () => getActiveTimezone(profile, currentOrganization),
    [profile, currentOrganization],
  );
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
  const [serviceType, setServiceType] = useState("Ambulatory");
  const [distanceMiles, setDistanceMiles] = useState<number | null>(null);
  const [durationMinutes, setDurationMinutes] = useState<number | null>(null);

  // Fetch Patient preference if no first trip
  const { data: patientDetails } = useQuery({
    queryKey: ["patient-pref", patientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patients")
        .select("vehicle_type_need")
        .eq("id", patientId)
        .single();
      if (error) return null;
      return data;
    },
    enabled: open && !!patientId,
  });

  // Fetch existing trips for this patient on this day to pre-fill pickup
  const { data: existingTrips } = useQuery({
    queryKey: [
      "trips-for-patient-day",
      patientId,
      formatInUserTimezone(date, activeTimezone, "yyyy-MM-dd"),
    ],
    queryFn: async () => {
      const dateStr = formatInUserTimezone(date, activeTimezone, "yyyy-MM-dd");
      const startOfDay = parseZonedTime(
        dateStr,
        "00:00",
        activeTimezone,
      ).toISOString();
      const endOfDay = parseZonedTime(
        dateStr,
        "23:59",
        activeTimezone,
      ).toISOString();

      const { data, error } = await supabase
        .from("trips")
        .select("*")
        .eq("patient_id", patientId)
        .gte("pickup_time", startOfDay)
        .lte("pickup_time", endOfDay)
        .order("pickup_time", { ascending: true });

      if (error) throw error;
      return data as Trip[];
    },
    enabled: open && !!patientId,
  });

  // Pre-fill logic when dialog opens or data is loaded
  useEffect(() => {
    if (open) {
      if (existingTrips && existingTrips.length > 0) {
        const lastTrip = existingTrips[existingTrips.length - 1];
        setPickupLocation(lastTrip.dropoff_location);
        setTripType(lastTrip.trip_type || "MEDICAL APPOINTMENT");
        setServiceType(lastTrip.billing_details?.service_type || "Ambulatory");
      } else if (patientDetails?.vehicle_type_need) {
        const mapping: Record<string, string> = {
          "COMMON CARRIER": "Ambulatory",
          "FOLDED WHEELCHAIR": "Foldable Wheelchair",
          WHEELCHAIR: "Wheelchair",
          VAN: "Ramp Van",
        };
        setServiceType(mapping[patientDetails.vehicle_type_need] || "Ambulatory");
      }
    }
  }, [open, existingTrips, patientDetails]);

  // Route calculation logic
  const calculateRoute = async (pickup: string, dropoff: string) => {
    if (!pickup || !dropoff || !isLoaded) return;
    try {
      const directionsService = new google.maps.DirectionsService();
      const result = await directionsService.route({
        origin: pickup,
        destination: dropoff,
        travelMode: google.maps.TravelMode.DRIVING,
      });

      if (result.routes[0]?.legs[0]) {
        const leg = result.routes[0].legs[0];
        setDistanceMiles(Math.ceil((leg.distance?.value || 0) * 0.000621371));
        setDurationMinutes(Math.ceil((leg.duration?.value || 0) / 60));
      }
    } catch (err) {
      console.error("Error calculating route:", err);
    }
  };

  const swapLocations = () => {
    const oldP = pickupLocation;
    const oldD = dropoffLocation;
    setPickupLocation(oldD);
    setDropoffLocation(oldP);
    if (oldD && oldP) calculateRoute(oldD, oldP);
  };

  const handleLocationChange = (field: "pickup" | "dropoff", value: string) => {
    if (field === "pickup") {
      setPickupLocation(value);
      if (value && dropoffLocation) calculateRoute(value, dropoffLocation);
    } else {
      setDropoffLocation(value);
      if (value && pickupLocation) calculateRoute(pickupLocation, value);
    }
  };

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
      const dateStr = formatInUserTimezone(date, activeTimezone, "yyyy-MM-dd");
      const pickupDateTime = parseZonedTime(
        dateStr,
        pickupTime,
        activeTimezone,
      );

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
        distance_miles: distanceMiles,
        duration_minutes: durationMinutes,
        billing_details: {
          service_type: serviceType,
        },
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
    setServiceType("Ambulatory");
    setDistanceMiles(null);
    setDurationMinutes(null);
    setError(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-[95vw] max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-2xl border-none shadow-2xl bg-white">
        <DialogHeader className="p-6 pb-4 border-b border-slate-100 bg-white">
          <DialogTitle className="text-xl font-bold text-slate-900">
            Smart Add Trip Leg
          </DialogTitle>
          <p className="text-sm text-slate-500 mt-1">
            Adding a transport leg for <strong>{patientName}</strong> on{" "}
            {formatInUserTimezone(date, activeTimezone, "MMMM d, yyyy")}
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

              <div className="relative space-y-4 p-5 bg-slate-50/50 rounded-xl border border-slate-100">
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
                      onChange={(val) => setPickupLocation(val)}
                      onAddressSelect={(place) => {
                        const address = place.formatted_address || place.name || "";
                        handleLocationChange("pickup", address);
                      }}
                      className="w-full rounded-xl border-slate-200 h-11 px-3 text-sm focus:ring-2 focus:ring-[#3D5A3D]/20 shadow-sm"
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

                {/* Swap Button */}
                <div className="absolute left-1/2 top-[76px] -translate-x-1/2 z-10 hidden md:block">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={swapLocations}
                    className="rounded-full h-8 w-8 bg-white border-slate-200 shadow-lg border-2 hover:border-[#3D5A3D]"
                  >
                    <ArrowsLeftRight weight="bold" className="w-4 h-4" />
                  </Button>
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
                      onChange={(val) => setDropoffLocation(val)}
                      onAddressSelect={(place) => {
                        const address = place.formatted_address || place.name || "";
                        handleLocationChange("dropoff", address);
                      }}
                      className="w-full rounded-xl border-slate-200 h-11 px-3 text-sm focus:ring-2 focus:ring-[#3D5A3D]/20 shadow-sm"
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

                {/* Metrics */}
                {(distanceMiles || durationMinutes) && (
                  <div className="flex items-center gap-4 mt-1 text-[11px] font-bold text-slate-500 px-1">
                    {distanceMiles && <span>{distanceMiles} miles</span>}
                    {durationMinutes && <span>~{durationMinutes} mins</span>}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-blue-500" />
                    Pickup Time
                  </Label>
                  <TimePicker value={pickupTime} onChange={setPickupTime} />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <ClipboardText className="w-4 h-4 text-orange-500" />
                    Trip Purpose
                  </Label>
                  <select
                    value={tripType}
                    onChange={(e) => setTripType(e.target.value)}
                    className="w-full h-10 rounded-md border border-slate-200 bg-white px-3 text-sm focus:ring-2 focus:ring-[#3D5A3D]/20"
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
                      className="mt-2 rounded-xl border-slate-200 h-11"
                    />
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <Car className="w-4 h-4 text-blue-600" />
                    Service Type
                  </Label>
                  <select
                    value={serviceType}
                    onChange={(e) => setServiceType(e.target.value)}
                    className="w-full h-10 rounded-md border border-slate-200 bg-white px-3 text-sm focus:ring-2 focus:ring-[#3D5A3D]/20"
                  >
                    {TRANSPORT_SERVICE_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                    <Car className="w-4 h-4 text-indigo-500" />
                    Assign Driver (Optional)
                  </Label>
                  <select
                    value={driverId}
                    onChange={(e) => setDriverId(e.target.value)}
                    className="w-full h-10 rounded-md border border-slate-200 bg-white px-3 text-sm focus:ring-2 focus:ring-[#3D5A3D]/20"
                  >
                    <option value="">Unassigned</option>
                    {drivers?.map((driver) => (
                      <option key={driver.id} value={driver.id}>
                        {driver.full_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label className="text-sm font-bold text-slate-700">
                    Notes
                  </Label>
                  <Textarea
                    placeholder="Add special instructions for the driver..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="rounded-xl border-slate-200 min-h-[100px] resize-none text-sm focus:ring-2 focus:ring-[#3D5A3D]/20"
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
              className="bg-[#3D5A3D] hover:bg-[#2E4A2E] text-white rounded-xl h-11 px-8 font-bold shadow-lg shadow-[#3D5A3D]/10"
            >
              {loading ? (
                <>
                  <CircleNotch weight="bold" className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Plus weight="bold" className="w-4 h-4 mr-2" />
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
