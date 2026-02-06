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
import { Card } from "@/components/ui/card";
import {
  User,
  MapPin,
  DownloadSimple,
  ArrowRight,
  ShieldCheck,
  IdentificationBadge,
  Check,
  Receipt,
  Truck,
} from "@phosphor-icons/react";
import { useLoadScript } from "@react-google-maps/api";
import { AddressAutocomplete } from "./AddressAutocomplete";
import { toast } from "sonner";
import { format } from "date-fns";
import { TimePicker } from "./trip-utils";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { cn } from "@/lib/utils";

const GOOGLE_MAPS_LIBRARIES: ("places" | "geometry")[] = ["places", "geometry"];

interface CreateDischargeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function CreateDischargeDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreateDischargeDialogProps) {
  const { isLoaded } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "",
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  const { currentOrganization } = useOrganization();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Form State
  const [formData, setFormData] = useState({
    patientFirstName: "",
    patientLastName: "",
    tripDate: format(new Date(), "yyyy-MM-dd"),
    tripTime: format(new Date(), "HH:mm"),
    pickupLocation: "",
    dropoffLocation: "",
    requesterFirstName: "",
    requesterLastName: "",
    requesterTitle: "",
    notes: "",
    serviceType: "Ambulatory", // Default
    distanceMiles: 0,
    deadheadMiles: 0,
    durationMinutes: 0,
    driverId: "" as string | null,
    baseFee: 0,
    perMileRate: 0,
    dhRate: 0,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<
    "details" | "pricing" | "review" | "success"
  >("details");

  // Fetch Organization Fees for Calculation
  const { data: fees } = useQuery({
    queryKey: ["organization_fees", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return null;
      const { data, error } = await supabase
        .from("organization_fees")
        .select("*")
        .eq("org_id", currentOrganization.id)
        .single();

      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
    enabled: !!currentOrganization?.id && open,
  });

  // Fetch Drivers
  const { data: drivers } = useQuery({
    queryKey: ["drivers", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];
      const { data, error } = await supabase
        .from("drivers")
        .select("id, first_name, last_name")
        .eq("org_id", currentOrganization.id);
      if (error) throw error;
      return data;
    },
    enabled: !!currentOrganization?.id && open,
  });

  // Sync Fees to FormData
  useEffect(() => {
    if (fees) {
      const isWheelchair = formData.serviceType !== "Ambulatory";
      setFormData((prev) => ({
        ...prev,
        baseFee: isWheelchair
          ? Number(fees.wheelchair_base_fee)
          : Number(fees.base_fee),
        perMileRate: isWheelchair
          ? Number(fees.wheelchair_per_mile_fee)
          : Number(fees.per_mile_fee),
        dhRate: isWheelchair
          ? Number(fees.deadhead_per_mile_wheelchair)
          : Number(fees.deadhead_per_mile_ambulatory),
      }));
    }
  }, [fees, formData.serviceType]);

  // Calculate Costs
  const billingBreakdown = useMemo(() => {
    const mileageCost = formData.distanceMiles * formData.perMileRate;
    const deadheadCost = formData.deadheadMiles * formData.dhRate;
    const total = formData.baseFee + mileageCost + deadheadCost;

    return {
      baseFee: formData.baseFee,
      perMileRate: formData.perMileRate,
      mileageCost,
      dhRate: formData.dhRate,
      deadheadCost,
      total,
    };
  }, [
    formData.baseFee,
    formData.perMileRate,
    formData.dhRate,
    formData.distanceMiles,
    formData.deadheadMiles,
  ]);

  const handlePlaceSelect = async (
    field: "pickupLocation" | "dropoffLocation",
    place: google.maps.places.PlaceResult,
  ) => {
    const value = place.formatted_address || "";
    setFormData((prev) => ({ ...prev, [field]: value }));

    const otherField =
      field === "pickupLocation" ? "dropoffLocation" : "pickupLocation";
    const otherValue = formData[otherField as keyof typeof formData] as string;

    if (value && otherValue && isLoaded) {
      try {
        const service = new google.maps.DirectionsService();
        const result = await service.route({
          origin: field === "pickupLocation" ? value : otherValue,
          destination: field === "dropoffLocation" ? value : otherValue,
          travelMode: google.maps.TravelMode.DRIVING,
        });

        if (result.routes[0]?.legs[0]) {
          const distanceMeters = result.routes[0].legs[0].distance?.value || 0;
          const durationSeconds = result.routes[0].legs[0].duration?.value || 0;
          const miles = Math.ceil(distanceMeters * 0.000621371);
          const minutes = Math.ceil(durationSeconds / 60);
          setFormData((prev) => ({
            ...prev,
            distanceMiles: miles,
            durationMinutes: minutes,
          }));
        }
      } catch (err) {
        console.error("Error calculating distance:", err);
      }
    }
  };

  const handleCreateTrip = async () => {
    if (!currentOrganization || !user) return;
    setIsLoading(true);

    try {
      // 1. Create or Find Patient
      const { data: existingPatients } = await supabase
        .from("patients")
        .select("id")
        .eq("org_id", currentOrganization.id)
        .ilike(
          "full_name",
          `${formData.patientFirstName} ${formData.patientLastName}`,
        )
        .limit(1);

      let patientId;
      if (existingPatients && existingPatients.length > 0) {
        patientId = existingPatients[0].id;
      } else {
        const { data: newPatient, error: pError } = await supabase
          .from("patients")
          .insert({
            org_id: currentOrganization.id,
            full_name: `${formData.patientFirstName} ${formData.patientLastName}`,
          })
          .select()
          .single();
        if (pError) throw pError;
        patientId = newPatient.id;
      }

      // 2. Insert Trip
      const { error: tError } = await supabase.from("trips").insert({
        org_id: currentOrganization.id,
        patient_id: patientId,
        driver_id: formData.driverId || null,
        pickup_location: formData.pickupLocation,
        dropoff_location: formData.dropoffLocation,
        pickup_time: new Date(
          `${formData.tripDate}T${formData.tripTime}`,
        ).toISOString(),
        trip_type: `DISCHARGE (${formData.serviceType})`,
        notes: formData.notes,
        status: formData.driverId ? "assigned" : "pending",
        requester_first_name: formData.requesterFirstName,
        requester_last_name: formData.requesterLastName,
        requester_title: formData.requesterTitle,
        entry_date: new Date().toISOString(),
        distance_miles: formData.distanceMiles,
        billing_details: {
          ...billingBreakdown,
          service_type: formData.serviceType,
          deadhead_miles: formData.deadheadMiles,
          distance_miles: formData.distanceMiles,
        },
      });

      if (tError) throw tError;

      toast.success("Discharge trip created successfully");
      queryClient.invalidateQueries({ queryKey: ["trips"] });
      toast.success("Discharge trip created successfully");
      queryClient.invalidateQueries({ queryKey: ["trips"] });
      setStep("success");
      onSuccess?.();
    } catch (err: any) {
      toast.error(err.message || "Failed to create discharge trip");
    } finally {
      setIsLoading(false);
    }
  };

  const generatePDF = () => {
    const doc = new jsPDF();
    const primaryColor = [61, 90, 61]; // #3D5A3D

    // Header
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(0, 0, 210, 40, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont("helvetica", "bold");
    doc.text("DISCHARGE TRIP SUMMARY", 105, 25, { align: "center" });

    doc.setTextColor(50, 50, 50);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Generated on: ${format(new Date(), "PPpp")}`, 105, 48, {
      align: "center",
    });

    // Organization Info
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(currentOrganization?.name || "Future Transportation", 20, 60);
    doc.setFont("helvetica", "normal");
    doc.text("Billing & Operations Department", 20, 66);

    // Patient & Trip Info
    autoTable(doc, {
      startY: 75,
      head: [["Trip Details", "Information"]],
      body: [
        [
          "Patient Name",
          `${formData.patientFirstName} ${formData.patientLastName}`,
        ],
        ["Scheduled For", `${formData.tripDate} at ${formData.tripTime}`],
        ["Pickup From", formData.pickupLocation],
        ["Destination", formData.dropoffLocation],
        ["Trip Distance", `${formData.distanceMiles} miles`],
        ["Service Level", formData.serviceType],
      ],
      headStyles: {
        fillColor: primaryColor as [number, number, number],
      },
      theme: "striped",
    });

    // Requester Info
    const finalY = (doc as any).lastAutoTable.finalY || 130;
    doc.setFont("helvetica", "bold");
    doc.text("Requested By", 20, finalY + 15);
    doc.setFont("helvetica", "normal");
    doc.text(
      `Name: ${formData.requesterFirstName} ${formData.requesterLastName}`,
      20,
      finalY + 22,
    );
    doc.text(`Title: ${formData.requesterTitle || "N/A"}`, 20, finalY + 28);

    // Financial Breakdown
    autoTable(doc, {
      startY: finalY + 40,
      head: [["Billing Component", "Rate", "Total"]],
      body: [
        [
          "Base Pickup Fee",
          `$${billingBreakdown?.baseFee.toFixed(2)}`,
          `$${billingBreakdown?.baseFee.toFixed(2)}`,
        ],
        [
          `Mileage (${formData.distanceMiles} mi)`,
          `$${billingBreakdown?.perMileRate.toFixed(2)}/mi`,
          `$${billingBreakdown?.mileageCost.toFixed(2)}`,
        ],
        [
          `Deadhead (${formData.deadheadMiles} mi)`,
          `$${billingBreakdown?.dhRate.toFixed(2)}/mi`,
          `$${billingBreakdown?.deadheadCost.toFixed(2)}`,
        ],
      ],
      headStyles: { fillColor: primaryColor as [number, number, number] },
      foot: [["TOTAL DUE", "", `$${billingBreakdown?.total.toFixed(2)}`]],
      footStyles: {
        fillColor: primaryColor as [number, number, number],
        textColor: [255, 255, 255],
      },
    });

    // Footer
    const lastY = (doc as any).lastAutoTable.finalY || 240;
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      "This document serves as an official billing intent for the requested discharge transport.",
      105,
      lastY + 20,
      { align: "center" },
    );

    doc.save(`Discharge_${formData.patientLastName}_${formData.tripDate}.pdf`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden bg-white border-none rounded-[2rem] shadow-2xl flex flex-col h-[90dvh] sm:h-[85vh] gap-0">
        <DialogHeader className="p-8 bg-slate-50 border-b border-slate-100 flex flex-row items-center justify-between shrink-0">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-[#3D5A3D] font-bold text-xs uppercase tracking-widest">
              <ShieldCheck size={18} weight="bold" />
              Secure Discharge Authorization
            </div>
            <DialogTitle className="text-3xl font-black text-slate-900 tracking-tight">
              Create Discharge Trip
            </DialogTitle>
          </div>
          <div className="flex items-center gap-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className={cn(
                  "w-10 h-1.5 rounded-full transition-all duration-500",
                  (step === "details" && i === 1) ||
                    (step === "pricing" && i === 2) ||
                    ((step === "review" || step === "success") && i === 3)
                    ? "bg-[#3D5A3D] w-16"
                    : "bg-slate-200",
                )}
              />
            ))}
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0">
          <div className="p-8">
            {step === "details" && (
              <div className="space-y-10 animate-in fade-in slide-in-from-right-4 duration-500">
                {/* Patient Section */}
                <section className="space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-lime-50 text-[#3D5A3D] flex items-center justify-center">
                      <User size={20} weight="bold" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-800">
                      Patient Information
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-slate-50/50 rounded-2xl border border-slate-100">
                    <div className="space-y-2">
                      <Label className="text-sm font-bold text-slate-600">
                        First Name
                      </Label>
                      <Input
                        value={formData.patientFirstName}
                        onChange={(e) =>
                          setFormData((p) => ({
                            ...p,
                            patientFirstName: e.target.value,
                          }))
                        }
                        placeholder="John"
                        className="h-12 rounded-xl bg-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-bold text-slate-600">
                        Last Name
                      </Label>
                      <Input
                        value={formData.patientLastName}
                        onChange={(e) =>
                          setFormData((p) => ({
                            ...p,
                            patientLastName: e.target.value,
                          }))
                        }
                        placeholder="Doe"
                        className="h-12 rounded-xl bg-white"
                      />
                    </div>
                  </div>
                </section>

                {/* Logistics Section */}
                <section className="space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                      <Truck size={20} weight="bold" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-800">
                      Trip Logistics
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-6 bg-slate-50/50 rounded-2xl border border-slate-100">
                    {/* Left Column: Locations and Service */}
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-sm font-bold text-slate-600 flex items-center gap-2">
                          <MapPin size={16} className="text-red-500" />{" "}
                          Discharge From
                        </Label>
                        <AddressAutocomplete
                          onAddressSelect={(val) =>
                            handlePlaceSelect("pickupLocation", val)
                          }
                          isLoaded={isLoaded}
                          value={formData.pickupLocation}
                          placeholder="Hospital or Facility address"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-bold text-slate-600 flex items-center gap-2">
                          <MapPin size={16} className="text-emerald-500" />{" "}
                          Transfer To
                        </Label>
                        <AddressAutocomplete
                          onAddressSelect={(val) =>
                            handlePlaceSelect("dropoffLocation", val)
                          }
                          isLoaded={isLoaded}
                          value={formData.dropoffLocation}
                          placeholder="Patient residence or facility"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4 pt-2">
                        <div className="space-y-2">
                          <Label className="text-sm font-bold text-slate-600">
                            Service Type
                          </Label>
                          <select
                            value={formData.serviceType}
                            onChange={(e) =>
                              setFormData((p) => ({
                                ...p,
                                serviceType: e.target.value,
                              }))
                            }
                            className="w-full h-12 rounded-xl border border-slate-200 bg-white px-3 text-sm focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none cursor-pointer"
                          >
                            <option value="Ambulatory">Common Carrier</option>
                            <option value="Wheelchair">Wheelchair</option>
                          </select>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm font-bold text-slate-600">
                            Assign Driver
                          </Label>
                          <select
                            value={formData.driverId || ""}
                            onChange={(e) =>
                              setFormData((p) => ({
                                ...p,
                                driverId: e.target.value || null,
                              }))
                            }
                            className="w-full h-12 rounded-xl border border-slate-200 bg-white px-3 text-sm focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none cursor-pointer"
                          >
                            <option value="">Unassigned</option>
                            {drivers?.map((driver: any) => (
                              <option key={driver.id} value={driver.id}>
                                {driver.first_name} {driver.last_name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Trip Metrics Display */}
                      {(formData.distanceMiles > 0 ||
                        formData.durationMinutes > 0) && (
                        <div className="flex items-center gap-6 mt-2 bg-blue-50 p-3 rounded-lg border border-blue-100">
                          {formData.distanceMiles > 0 && (
                            <div className="flex items-center gap-2 text-sm text-slate-700">
                              <span className="font-semibold text-blue-600">
                                Dist:
                              </span>
                              {formData.distanceMiles} mi
                            </div>
                          )}
                          {formData.durationMinutes > 0 && (
                            <div className="flex items-center gap-2 text-sm text-slate-700">
                              <span className="font-semibold text-blue-600">
                                Time:
                              </span>
                              {formData.durationMinutes} min
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Right Column: Schedule and Notes */}
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-sm font-black text-slate-500 uppercase tracking-widest">
                          Scheduled Date
                        </Label>
                        <Input
                          type="date"
                          value={formData.tripDate}
                          onChange={(e) =>
                            setFormData((p) => ({
                              ...p,
                              tripDate: e.target.value,
                            }))
                          }
                          className="h-14 rounded-2xl bg-white border-slate-200 text-lg font-medium focus:ring-4 focus:ring-[#3D5A3D]/10 focus:border-[#3D5A3D] transition-all"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-black text-slate-500 uppercase tracking-widest">
                          Scheduled Time
                        </Label>
                        <TimePicker
                          value={formData.tripTime}
                          onChange={(val: string) =>
                            setFormData((p) => ({ ...p, tripTime: val }))
                          }
                          className="w-full"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-bold text-slate-600">
                          Special Instructions
                        </Label>
                        <Textarea
                          value={formData.notes}
                          onChange={(e) =>
                            setFormData((p) => ({
                              ...p,
                              notes: e.target.value,
                            }))
                          }
                          placeholder="Entry codes, floor details..."
                          className="min-h-[100px] rounded-xl bg-white resize-none"
                        />
                      </div>
                    </div>
                  </div>
                </section>

                {/* Requester Section */}
                <section className="space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                      <IdentificationBadge size={20} weight="bold" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-800">
                      Caller / Requester Information
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6 bg-slate-50/50 rounded-2xl border border-slate-100">
                    <div className="space-y-2">
                      <Label className="text-sm font-bold text-slate-600">
                        First Name
                      </Label>
                      <Input
                        value={formData.requesterFirstName}
                        onChange={(e) =>
                          setFormData((p) => ({
                            ...p,
                            requesterFirstName: e.target.value,
                          }))
                        }
                        className="h-12 rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-bold text-slate-600">
                        Last Name
                      </Label>
                      <Input
                        value={formData.requesterLastName}
                        onChange={(e) =>
                          setFormData((p) => ({
                            ...p,
                            requesterLastName: e.target.value,
                          }))
                        }
                        className="h-12 rounded-xl"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-bold text-slate-600">
                        Title{" "}
                        <span className="text-slate-400 font-normal ml-1">
                          (Optional)
                        </span>
                      </Label>
                      <Input
                        value={formData.requesterTitle}
                        onChange={(e) =>
                          setFormData((p) => ({
                            ...p,
                            requesterTitle: e.target.value,
                          }))
                        }
                        placeholder="e.g. Charge Nurse"
                        className="h-12 rounded-xl"
                      />
                    </div>
                  </div>
                </section>
              </div>
            )}

            {step === "pricing" && (
              <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <Receipt size={20} weight="bold" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-slate-800">
                        Financial Setup
                      </h3>
                      <p className="text-xs text-slate-500">
                        Configure rates based on facility agreement.
                      </p>
                    </div>
                  </div>
                  <div className="flex bg-slate-100 p-1 rounded-xl">
                    {["Common Carrier", "Wheelchair"].map((type) => (
                      <button
                        key={type}
                        onClick={() =>
                          setFormData((p) => ({ ...p, serviceType: type }))
                        }
                        className={cn(
                          "px-6 py-2 rounded-lg text-sm font-bold transition-all",
                          formData.serviceType === type
                            ? "bg-white text-slate-900 shadow-sm"
                            : "text-slate-400 hover:text-slate-600",
                        )}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                  <div className="lg:col-span-12">
                    <Card className="border-none shadow-xl shadow-slate-200/50 bg-white rounded-[2rem] overflow-hidden">
                      <div className="divide-y divide-slate-100">
                        {/* Base Pickup */}
                        <div className="p-8 flex items-center justify-between">
                          <div className="space-y-1">
                            <Label className="text-lg font-bold text-slate-800">
                              Base Pickup Fee
                            </Label>
                            <p className="text-sm text-slate-400 italic">
                              Facility discharge rate.
                            </p>
                          </div>
                          <div className="w-40 relative group">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
                              $
                            </span>
                            <Input
                              type="number"
                              step="0.01"
                              value={formData.baseFee}
                              onChange={(e) =>
                                setFormData((p) => ({
                                  ...p,
                                  baseFee: Number(e.target.value),
                                }))
                              }
                              className="pl-8 h-12 text-xl font-bold text-slate-900 font-mono bg-white border-2 border-slate-100 rounded-xl text-right focus:border-emerald-500 transition-all"
                            />
                          </div>
                        </div>

                        {/* Mileage */}
                        <div className="p-8 flex items-center justify-between gap-6">
                          <div className="flex-1 space-y-1">
                            <Label className="text-lg font-bold text-slate-800">
                              Calculated Mileage ($/mi)
                            </Label>
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-slate-400 italic">
                                Rate:
                              </span>
                              <div className="w-24 relative">
                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">
                                  $
                                </span>
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={formData.perMileRate}
                                  onChange={(e) =>
                                    setFormData((p) => ({
                                      ...p,
                                      perMileRate: Number(e.target.value),
                                    }))
                                  }
                                  className="pl-5 h-8 text-sm font-bold rounded-lg border-slate-200"
                                />
                              </div>
                            </div>
                            <p className="text-sm text-slate-400 italic">
                              Distance: {formData.distanceMiles} miles
                            </p>
                          </div>
                          <div className="w-40 relative group">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
                              $
                            </span>
                            <Input
                              readOnly
                              value={billingBreakdown?.mileageCost.toFixed(2)}
                              className="pl-8 h-14 text-2xl font-black text-slate-900 font-mono bg-slate-50 border-none rounded-xl text-right"
                            />
                          </div>
                        </div>

                        {/* Deadhead */}
                        <div className="p-8 flex items-center justify-between gap-6">
                          <div className="flex-1 space-y-1">
                            <Label className="text-lg font-bold text-slate-800">
                              Deadhead Miles ($/mi)
                            </Label>
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-slate-400 italic">
                                Rate:
                              </span>
                              <div className="w-24 relative">
                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">
                                  $
                                </span>
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={formData.dhRate}
                                  onChange={(e) =>
                                    setFormData((p) => ({
                                      ...p,
                                      dhRate: Number(e.target.value),
                                    }))
                                  }
                                  className="pl-5 h-8 text-sm font-bold rounded-lg border-slate-200"
                                />
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="w-24 relative">
                              <Input
                                type="number"
                                value={formData.deadheadMiles}
                                onChange={(e) =>
                                  setFormData((p) => ({
                                    ...p,
                                    deadheadMiles: Number(e.target.value),
                                  }))
                                }
                                className="h-14 font-bold text-xl text-center rounded-xl bg-blue-50/50 border-blue-100"
                              />
                            </div>
                            <div className="w-40 relative group">
                              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
                                $
                              </span>
                              <Input
                                readOnly
                                value={billingBreakdown?.deadheadCost.toFixed(
                                  2,
                                )}
                                className="pl-8 h-14 text-2xl font-black text-slate-900 font-mono bg-slate-50 border-none rounded-xl text-right"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </Card>
                  </div>
                </div>

                <div className="bg-[#0A2619] rounded-[2rem] p-10 text-white flex items-center justify-between shadow-2xl shadow-emerald-900/20">
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-emerald-400 uppercase tracking-widest">
                      Estimated Total Billable
                    </p>
                    <p className="text-sm text-white/50">
                      Subject to real-time adjustments
                    </p>
                  </div>
                  <div className="text-6xl font-black font-mono tracking-tighter">
                    ${billingBreakdown?.total.toFixed(2)}
                  </div>
                </div>
              </div>
            )}

            {step === "review" && (
              <div className="space-y-8 animate-in slide-in-from-right-4 duration-500">
                <div className="text-center space-y-2">
                  <h3 className="text-2xl font-black text-slate-900">
                    Review & Authorize
                  </h3>
                  <p className="text-slate-500">
                    Verify trip details and download the discharge summary
                  </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Trip Summary Card */}
                  <Card className="p-6 space-y-4 border-slate-200 shadow-sm bg-slate-50/50">
                    <h4 className="font-bold text-slate-800 flex items-center gap-2">
                      <Receipt className="w-5 h-5 text-[#3D5A3D]" />
                      Billing Summary
                    </h4>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between p-3 bg-white rounded-lg border border-slate-100">
                        <span className="font-medium text-slate-600">
                          Base Fee
                        </span>
                        <span className="font-bold text-slate-900">
                          ${billingBreakdown?.baseFee.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between p-3 bg-white rounded-lg border border-slate-100">
                        <span className="font-medium text-slate-600">
                          Mileage ({formData.distanceMiles} mi)
                        </span>
                        <span className="font-bold text-slate-900">
                          ${billingBreakdown?.mileageCost.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between p-3 bg-white rounded-lg border border-slate-100">
                        <span className="font-medium text-slate-600">
                          Deadhead ({formData.deadheadMiles} mi)
                        </span>
                        <span className="font-bold text-slate-900">
                          ${billingBreakdown?.deadheadCost.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between pt-2">
                        <span className="font-black text-slate-900 text-lg">
                          Total
                        </span>
                        <span className="font-black text-[#3D5A3D] text-lg">
                          ${billingBreakdown?.total.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </Card>

                  {/* Actions Card */}
                  <Card className="p-6 space-y-6 border-slate-200 shadow-sm bg-white flex flex-col justify-center">
                    <div className="space-y-4">
                      <Button
                        onClick={generatePDF}
                        variant="outline"
                        className="w-full h-14 rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50 gap-2 font-bold shadow-sm"
                      >
                        <DownloadSimple size={20} weight="bold" />
                        Download Discharge PDF
                      </Button>
                      <div className="text-center text-xs text-slate-400 font-medium px-4">
                        Please download the PDF for your records before
                        authorizing the trip.
                      </div>
                    </div>
                  </Card>
                </div>
              </div>
            )}

            {step === "success" && (
              <div className="space-y-8 animate-in zoom-in-95 duration-500 text-center py-10">
                <div className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Check size={48} weight="bold" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-3xl font-black text-slate-900">
                    Success! Trip Authorized
                  </h3>
                  <p className="text-slate-500 max-w-sm mx-auto">
                    The discharge trip for{" "}
                    <strong>
                      {formData.patientFirstName} {formData.patientLastName}
                    </strong>{" "}
                    has been prioritized in the scheduler.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-md mx-auto pt-8">
                  <Button
                    onClick={generatePDF}
                    className="h-16 rounded-2xl bg-[#3D5A3D] hover:bg-[#2E4A2E] text-white flex flex-col items-center justify-center gap-1 shadow-lg"
                  >
                    <DownloadSimple size={24} weight="bold" />
                    <span className="text-xs font-bold uppercase tracking-wider">
                      Download PDF
                    </span>
                  </Button>
                  <Button
                    onClick={() => onOpenChange(false)}
                    variant="outline"
                    className="h-16 rounded-2xl border-slate-200 text-slate-600 hover:bg-slate-50 flex flex-col items-center justify-center gap-1"
                  >
                    <ArrowRight size={24} weight="bold" />
                    <span className="text-xs font-bold uppercase tracking-wider">
                      Close Dialog
                    </span>
                  </Button>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="p-8 bg-slate-50 border-t border-slate-100 shrink-0">
          {step === "details" && (
            <Button
              onClick={() => setStep("pricing")}
              disabled={
                !formData.pickupLocation ||
                !formData.dropoffLocation ||
                !formData.patientFirstName
              }
              className="w-full h-14 bg-[#3D5A3D] hover:bg-[#2E4A2E] text-white rounded-2xl text-lg font-bold gap-3 shadow-xl transition-all"
            >
              Go To Billing
              <ArrowRight size={24} weight="bold" />
            </Button>
          )}

          {step === "pricing" && (
            <div className="flex gap-4 w-full">
              <Button
                variant="outline"
                onClick={() => setStep("details")}
                className="h-14 px-8 rounded-2xl font-bold text-slate-600"
              >
                Back
              </Button>
              <Button
                onClick={() => setStep("review")}
                className="flex-1 h-14 bg-[#3D5A3D] hover:bg-[#2E4A2E] text-white rounded-2xl text-xl font-black gap-3 shadow-xl transition-all"
              >
                Review & Authorize
                <ArrowRight size={24} weight="bold" />
              </Button>
            </div>
          )}

          {step === "review" && (
            <div className="flex gap-4 w-full">
              <Button
                variant="outline"
                onClick={() => setStep("pricing")}
                className="h-14 px-8 rounded-2xl font-bold text-slate-600"
              >
                Back
              </Button>
              <Button
                onClick={handleCreateTrip}
                disabled={isLoading}
                className="flex-1 h-14 bg-[#3D5A3D] hover:bg-[#2E4A2E] text-white rounded-2xl text-xl font-black gap-3 shadow-xl transition-all"
              >
                {isLoading ? (
                  "Authorizing..."
                ) : (
                  <>
                    Authorize Trip
                    <ShieldCheck size={24} weight="bold" />
                  </>
                )}
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
