import React, { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Loader2,
  User,
  Car,
  MapPin,
  Calendar,
  Clock,
  Clipboard,
} from "lucide-react";

interface CreateTripFormProps {
  onSuccess: () => void;
  onCancel: () => void;
  onLoadingChange?: (loading: boolean) => void;
  tripId?: string;
}

export function CreateTripForm({
  onSuccess,
  onLoadingChange,
  tripId,
}: CreateTripFormProps) {
  const { currentOrganization } = useOrganization();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    patient_id: "",
    driver_id: "",
    pickup_location: "",
    dropoff_location: "",
    pickup_date: "",
    pickup_time: "",
    trip_type: "Ambulatory",
    notes: "",
  });

  // Fetch existing trip if editing - use different query key to avoid cache conflicts
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
        setFormData({
          patient_id: existingTrip.patient_id,
          driver_id: existingTrip.driver_id || "",
          pickup_location: existingTrip.pickup_location || "",
          dropoff_location: existingTrip.dropoff_location || "",
          pickup_date: date.toISOString().split("T")[0],
          pickup_time: date.toTimeString().split(" ")[0].substring(0, 5),
          trip_type: existingTrip.trip_type || "Ambulatory",
          notes: existingTrip.notes || "",
        });
      }
    }
  }, [existingTrip]);

  const { data: patients } = useQuery({
    queryKey: ["patients-form", currentOrganization?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patients")
        .select("id, full_name")
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
        .select("id, full_name, email, phone")
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

  // Merge drivers and employees, removing duplicates (based on email or name if needed, but let's keep it simple for now)
  const allPotentialDrivers = [
    ...(drivers || []).map((d) => ({ ...d, type: "driver" as const })),
    ...(employees || [])
      .filter((e) => !(drivers || []).some((d) => d.email === e.email))
      .map((e) => ({ ...e, type: "employee" as const })),
  ].sort((a, b) => (a.full_name || "").localeCompare(b.full_name || ""));

  const toggleLoading = (val: boolean) => {
    onLoadingChange?.(val);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrganization) return;
    toggleLoading(true);

    try {
      const pickupDateTime = new Date(
        `${formData.pickup_date}T${formData.pickup_time}`
      );
      let finalDriverId = formData.driver_id;

      // If an employee was selected who isn't a driver yet, we need to create a driver record
      const selectedEntity = allPotentialDrivers.find(
        (p) => p.id === formData.driver_id
      );
      if (selectedEntity && selectedEntity.type === "employee") {
        // Check if they already exist in drivers table (maybe by email)
        const { data: existingDriver } = await supabase
          .from("drivers")
          .select("id")
          .eq("email", selectedEntity.email)
          .single();

        if (existingDriver) {
          finalDriverId = existingDriver.id;
        } else {
          // Create a new driver record for this employee
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

      const payload = {
        org_id: currentOrganization.id,
        patient_id: formData.patient_id,
        driver_id: finalDriverId || null,
        pickup_location: formData.pickup_location,
        dropoff_location: formData.dropoff_location,
        pickup_time: pickupDateTime.toISOString(),
        trip_type: formData.trip_type,
        notes: formData.notes,
        status: finalDriverId
          ? existingTrip?.status === "pending"
            ? "assigned"
            : existingTrip?.status || "assigned"
          : "pending",
      };

      if (tripId) {
        const { error } = await supabase
          .from("trips")
          .update(payload)
          .eq("id", tripId);
        if (error) throw error;
        // Invalidate the specific trip and trips list cache
        queryClient.invalidateQueries({ queryKey: ["trip", tripId] });
      } else {
        const { error } = await supabase.from("trips").insert(payload);
        if (error) throw error;
      }

      // Invalidate trips list to refresh immediately
      await queryClient.invalidateQueries({ queryKey: ["trips"] });

      onSuccess();
    } catch (error) {
      console.error("Error saving trip:", error);
      alert("Failed to save trip");
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
    <div className="bg-white">
      <div className="space-y-8">
        <form
          id="create-trip-form"
          onSubmit={handleSubmit}
          className="space-y-8"
        >
          {/* Patient & Driver Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-6 bg-slate-50 rounded-xl border border-slate-100">
            <div className="space-y-4">
              <Label className="flex items-center gap-2 text-slate-700 font-semibold">
                <User className="w-4 h-4 text-blue-500" />
                Patient Information
              </Label>
              <select
                required
                value={formData.patient_id}
                onChange={(e) =>
                  setFormData({ ...formData, patient_id: e.target.value })
                }
                className="w-full rounded-lg border-slate-200 bg-white p-2.5 focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="">Select Patient</option>
                {patients?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-4">
              <Label className="flex items-center gap-2 text-slate-700 font-semibold">
                <Car className="w-4 h-4 text-emerald-500" />
                Assign Driver (Optional)
              </Label>
              <select
                value={formData.driver_id}
                onChange={(e) =>
                  setFormData({ ...formData, driver_id: e.target.value })
                }
                className="w-full rounded-lg border-slate-200 bg-white p-2.5 focus:ring-2 focus:ring-emerald-500/20"
              >
                <option value="">Unassigned</option>
                {allPotentialDrivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.full_name} {d.type === "employee" ? "(Staff)" : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Locations Section */}
          <div className="space-y-6">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
              Trip Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-red-500" />
                  Pickup Location
                </Label>
                <Input
                  required
                  placeholder="Enter full address"
                  value={formData.pickup_location}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      pickup_location: e.target.value,
                    })
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
                  value={formData.dropoff_location}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      dropoff_location: e.target.value,
                    })
                  }
                />
              </div>
            </div>
          </div>

          {/* Schedule Section */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-500" />
                Date
              </Label>
              <Input
                required
                type="date"
                value={formData.pickup_date}
                onChange={(e) =>
                  setFormData({ ...formData, pickup_date: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-500" />
                Time
              </Label>
              <Input
                required
                type="time"
                value={formData.pickup_time}
                onChange={(e) =>
                  setFormData({ ...formData, pickup_time: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Clipboard className="w-4 h-4 text-slate-500" />
                Trip Type
              </Label>
              <select
                value={formData.trip_type}
                onChange={(e) =>
                  setFormData({ ...formData, trip_type: e.target.value })
                }
                className="w-full rounded-lg border-slate-200 bg-white p-2.5"
              >
                <option>Ambulatory</option>
                <option>Wheelchair</option>
                <option>Stretcher</option>
                <option>Bariatric</option>
              </select>
            </div>
          </div>

          {/* Notes Section */}
          <div className="space-y-2">
            <Label>Special Instructions / Notes</Label>
            <Textarea
              placeholder="Add any specific details for the driver or trip..."
              className="min-h-[120px]"
              value={formData.notes}
              onChange={(e) =>
                setFormData({ ...formData, notes: e.target.value })
              }
            />
          </div>
        </form>
      </div>
    </div>
  );
}
