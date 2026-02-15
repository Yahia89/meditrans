import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Warning,
  CircleNotch,
  FileText,
  User,
  Calendar,
  CheckCircle,
  XCircle,
  ArrowsClockwise,
  DownloadSimple,
} from "@phosphor-icons/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useOrganization } from "@/contexts/OrganizationContext";
import { validateTrip } from "@/lib/billing/claim-validator";
import {
  generateDownloadable837P,
  download837PFile,
} from "@/lib/billing/837p-generator";
import {
  getHCPCSCodes,
  determineVehicleType,
  calculateMileageCharge,
  DEFAULT_RATES,
} from "@/lib/billing/hcpcs-codes";
import { format } from "date-fns";

interface ClaimSummaryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function ClaimSummaryDialog({
  open,
  onOpenChange,
  onSuccess,
}: ClaimSummaryDialogProps) {
  const { currentOrganization } = useOrganization();
  const queryClient = useQueryClient();
  const [selectedTrips, setSelectedTrips] = useState<Set<string>>(new Set());

  // Fetch Service Agreements for automatic SA# mapping
  const { data: serviceAgreements } = useQuery({
    queryKey: ["active-agreements", currentOrganization?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("billing_service_agreements")
        .select("*, lines:billing_service_agreement_lines(*)")
        .eq("status", "active");
      if (error) return [];
      return data;
    },
    enabled: !!currentOrganization?.id && open,
  });

  // Fetch billable trips
  const {
    data: billableTrips,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["billable-trips", currentOrganization?.id],
    queryFn: async () => {
      if (!currentOrganization?.id) return [];

      const { data: trips, error } = await supabase
        .from("trips")
        .select(
          `
          *,
          patient:patients(*),
          driver:drivers(*)
        `,
        )
        .eq("org_id", currentOrganization.id)
        .eq("status", "completed")
        .order("scheduled_date", { ascending: false });

      if (error) throw error;

      const { data: claimLines } = await supabase
        .from("billing_claim_lines")
        .select("trip_id")
        .eq("status", "included");

      const billedTripIds = new Set(claimLines?.map((l) => l.trip_id) || []);

      return trips
        .filter((t) => !billedTripIds.has(t.id))
        .map((trip) => {
          // Find matching service agreement for this patient/date
          const matchingSA = serviceAgreements?.find(
            (sa) =>
              sa.patient_id === trip.patient_id &&
              new Date(trip.scheduled_date) >= new Date(sa.effective_date) &&
              new Date(trip.scheduled_date) <= new Date(sa.expiration_date),
          );

          const validationTrip = {
            ...trip,
            patient: {
              full_name: `${trip.patient.first_name} ${trip.patient.last_name}`,
              medicaid_id: trip.patient.medicaid_id,
            },
            driver: trip.driver
              ? {
                  full_name: `${trip.driver.first_name} ${trip.driver.last_name}`,
                  umpi: trip.driver.umpi,
                  npi: trip.driver.npi,
                }
              : null,
            service_agreement_number: matchingSA?.agreement_number,
          };

          const errors = validateTrip(
            validationTrip as any,
            currentOrganization as any,
          );
          return {
            ...trip,
            service_agreement_number: matchingSA?.agreement_number,
            errors,
            isValid: errors.length === 0,
          };
        });
    },
    enabled: !!currentOrganization?.id && open && !!serviceAgreements,
  });

  const validTrips = useMemo(
    () => billableTrips?.filter((t) => t.isValid) || [],
    [billableTrips],
  );
  const invalidTrips = useMemo(
    () => billableTrips?.filter((t) => !t.isValid) || [],
    [billableTrips],
  );

  const toggleTrip = (id: string, isValid: boolean) => {
    if (!isValid) return;
    const next = new Set(selectedTrips);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedTrips(next);
  };

  const selectAll = () => {
    if (selectedTrips.size === validTrips.length) {
      setSelectedTrips(new Set());
    } else {
      setSelectedTrips(new Set(validTrips.map((t) => t.id)));
    }
  };

  const generateClaimMutation = useMutation({
    mutationFn: async () => {
      if (!currentOrganization?.id || selectedTrips.size === 0) return;

      const tripsToBill =
        billableTrips?.filter((t) => selectedTrips.has(t.id)) || [];

      const claimControlNumber = `CLM-${format(new Date(), "yyyyMMdd")}-${Math.random().toString(36).substring(7).toUpperCase()}`;

      const { data: claim, error: claimError } = await supabase
        .from("billing_claims")
        .insert({
          org_id: currentOrganization.id,
          claim_control_number: claimControlNumber,
          status: "draft",
          billing_period_start:
            tripsToBill[tripsToBill.length - 1].scheduled_date,
          billing_period_end: tripsToBill[0].scheduled_date,
          total_charge: 0,
          total_trips: tripsToBill.length,
        })
        .select()
        .single();

      if (claimError) throw claimError;

      let totalCharge = 0;
      const lines = tripsToBill.flatMap((trip) => {
        const vehicleType = determineVehicleType(trip.vehicle_type);
        const codes = getHCPCSCodes(
          currentOrganization.billing_state as "MN" | "CA",
          vehicleType,
        );

        const baseRate = DEFAULT_RATES[codes.base.code] || 25.0;
        const baseLine = {
          claim_id: claim.id,
          trip_id: trip.id,
          patient_id: trip.patient_id,
          driver_id: trip.driver_id,
          service_date: trip.scheduled_date,
          hcpcs_code: codes.base.code,
          units: 1,
          charge_amount: baseRate,
          pickup_address: trip.pickup_location,
          dropoff_address: trip.dropoff_location,
          status: "included",
        };

        const miles = trip.actual_distance_miles || 0;
        const mileageRate = DEFAULT_RATES[codes.mileage.code] || 2.0;
        const mileageLine =
          miles > 0
            ? {
                claim_id: claim.id,
                trip_id: trip.id,
                patient_id: trip.patient_id,
                driver_id: trip.driver_id,
                service_date: trip.scheduled_date,
                hcpcs_code: codes.mileage.code,
                units: miles,
                charge_amount: miles * mileageRate,
                pickup_address: trip.pickup_location,
                dropoff_address: trip.dropoff_location,
                status: "included",
              }
            : null;

        totalCharge +=
          baseLine.charge_amount + (mileageLine?.charge_amount || 0);
        return mileageLine ? [baseLine, mileageLine] : [baseLine];
      });

      const { error: linesError } = await supabase
        .from("billing_claim_lines")
        .insert(lines);
      if (linesError) throw linesError;

      await supabase
        .from("billing_claims")
        .update({ total_charge: totalCharge, status: "generated" })
        .eq("id", claim.id);

      // Generate 837P Data with Service Agreement injected
      const claimData = {
        organization: currentOrganization,
        claim: {
          controlNumber: claimControlNumber,
          billingPeriodStart:
            tripsToBill[tripsToBill.length - 1].scheduled_date,
          billingPeriodEnd: tripsToBill[0].scheduled_date,
        },
        lines: tripsToBill.map((t) => {
          const vehicleType = determineVehicleType(t.vehicle_type);
          const { base, mileage } = getHCPCSCodes(
            currentOrganization.billing_state as any,
            vehicleType,
          );
          const { charge: mileageAmount } = calculateMileageCharge(
            t.actual_distance_miles || 0,
            DEFAULT_RATES[mileage.code] || 2.0,
          );

          return {
            patientName: `${t.patient.first_name} ${t.patient.last_name}`,
            patientDOB: t.patient.date_of_birth,
            medicaidId: t.patient.medicaid_id!,
            serviceDate: t.scheduled_date,
            hcpcsCode: base.code,
            units: 1,
            chargeAmount: (DEFAULT_RATES[base.code] || 25.0) + mileageAmount,
            diagnosisCode: t.patient.diagnosis_code || "Z76.89",
            pickupAddress: t.pickup_location,
            dropoffAddress: t.dropoff_location,
            driverName: t.driver
              ? `${t.driver.first_name} ${t.driver.last_name}`
              : "Unknown Driver",
            driverUMPI: t.driver?.umpi,
            driverNPI: t.driver?.npi,
            authorizationNumber: t.service_agreement_number, // INJECTED SA NUMBER
          };
        }),
      };

      const { content, filename } = generateDownloadable837P(claimData as any);
      download837PFile(content, filename);
      return claim;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["billable-trips"] });
      onSuccess?.();
      onOpenChange(false);
      setSelectedTrips(new Set());
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[95vw] h-[90vh] flex flex-col p-0 overflow-hidden border-slate-200/60 shadow-2xl rounded-2xl">
        <DialogHeader className="p-8 border-b border-slate-100 bg-white shrink-0">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <DialogTitle className="text-2xl font-black text-slate-900 flex items-center gap-3">
                <FileText
                  size={32}
                  weight="duotone"
                  className="text-slate-400"
                />
                Claim Batching
              </DialogTitle>
              <DialogDescription className="text-slate-500 font-medium italic">
                {currentOrganization?.billing_state} Medicaid Professional 837P
                Generation
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col p-8 space-y-8 bg-slate-50/30">
          {isLoading ? (
            <div className="flex-1 flex flex-col items-center justify-center space-y-4">
              <CircleNotch
                size={48}
                className="text-slate-300 animate-spin"
                weight="bold"
              />
              <p className="text-slate-400 font-black uppercase tracking-widest text-[10px]">
                Verifying eligibility...
              </p>
            </div>
          ) : isError ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4">
              <Warning size={48} weight="duotone" className="text-red-400" />
              <h3 className="text-lg font-bold text-slate-900">Sync Failure</h3>
              <p className="text-slate-500 max-w-sm text-sm italic">
                Could not coordinate with provider database.
              </p>
              <Button
                onClick={() => refetch()}
                variant="outline"
                className="gap-2 font-bold uppercase text-[10px] tracking-widest"
              >
                <ArrowsClockwise size={16} /> Retry Sync
              </Button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-6">
                <div className="bg-white rounded-2xl p-6 border border-slate-200/60 flex items-center justify-between transition-all">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                      Clean Records
                    </p>
                    <p className="text-3xl font-black text-slate-900">
                      {validTrips.length}
                    </p>
                  </div>
                  <div className="bg-emerald-50 text-emerald-600 p-3 rounded-2xl">
                    <CheckCircle size={24} weight="duotone" />
                  </div>
                </div>
                <div className="bg-white rounded-2xl p-6 border border-slate-200/60 flex items-center justify-between transition-all">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                      Needs Attention
                    </p>
                    <p className="text-3xl font-black text-slate-900">
                      {invalidTrips.length}
                    </p>
                  </div>
                  <div className="bg-amber-50 text-amber-600 p-3 rounded-2xl">
                    <Warning size={24} weight="duotone" />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between border-b border-slate-200/60 pb-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={selectAll}
                  className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-slate-900 hover:bg-slate-100 px-4 rounded-full"
                >
                  {selectedTrips.size === validTrips.length
                    ? "Deselect All"
                    : "Select All Valid"}
                </Button>
                <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <User size={14} weight="duotone" />
                  {billableTrips?.length || 0} Trips Detected
                </div>
              </div>

              <ScrollArea className="flex-1 rounded-2xl overflow-hidden border border-slate-200/60 bg-white/50">
                <div className="divide-y divide-slate-100">
                  {billableTrips?.length === 0 ? (
                    <div className="py-24 text-center">
                      <p className="text-slate-400 font-bold italic">
                        No completed trips awaiting billing.
                      </p>
                    </div>
                  ) : (
                    billableTrips?.map((trip) => (
                      <div
                        key={trip.id}
                        className={`p-6 flex items-center gap-6 transition-all hover:bg-white cursor-pointer group ${!trip.isValid ? "opacity-50 grayscale" : ""}`}
                        onClick={() => toggleTrip(trip.id, trip.isValid)}
                      >
                        <div className="shrink-0">
                          {trip.isValid ? (
                            <div
                              className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${selectedTrips.has(trip.id) ? "bg-slate-900 border-slate-900" : "border-slate-300 group-hover:border-slate-400"}`}
                            >
                              {selectedTrips.has(trip.id) && (
                                <CheckCircle
                                  size={16}
                                  weight="bold"
                                  className="text-white"
                                />
                              )}
                            </div>
                          ) : (
                            <XCircle
                              size={24}
                              weight="duotone"
                              className="text-slate-300"
                            />
                          )}
                        </div>

                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-black text-slate-900">
                              {trip.patient.first_name} {trip.patient.last_name}
                            </span>
                            <Badge
                              variant="outline"
                              className="text-[9px] font-black uppercase tracking-widest bg-slate-50 border-slate-200 text-slate-500"
                            >
                              {trip.patient.medicaid_id || "NO ID"}
                            </Badge>
                            {trip.service_agreement_number && (
                              <Badge
                                variant="secondary"
                                className="text-[9px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-700 border-none"
                              >
                                SA: {trip.service_agreement_number}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-[11px] text-slate-400 font-bold">
                            <span className="flex items-center gap-1.5">
                              <Calendar size={14} weight="duotone" />{" "}
                              {format(
                                new Date(trip.scheduled_date),
                                "MMM d, yyyy",
                              )}
                            </span>
                            <span className="uppercase tracking-widest">
                              {trip.vehicle_type}
                            </span>
                            <span>{trip.actual_distance_miles || 0}.0m</span>
                          </div>
                        </div>

                        <div className="shrink-0">
                          {!trip.isValid && (
                            <div className="text-right">
                              <span className="text-[9px] font-black text-red-600 bg-red-50 px-2 py-0.5 rounded-full uppercase tracking-tighter">
                                Rejected by Validator
                              </span>
                              <p className="text-[10px] text-red-400 mt-1 italic max-w-[180px] break-words">
                                {trip.errors[0]?.message}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </>
          )}
        </div>

        <DialogFooter className="p-8 border-t border-slate-100 bg-white shrink-0 flex items-center justify-between">
          <div className="hidden sm:block">
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">
              Selected {selectedTrips.size} / {validTrips.length}
            </p>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="font-bold text-slate-500 hover:text-slate-900 hover:bg-slate-50 px-6"
            >
              Discard Batch
            </Button>
            <Button
              disabled={
                selectedTrips.size === 0 || generateClaimMutation.isPending
              }
              onClick={() => generateClaimMutation.mutate()}
              className="bg-slate-900 text-white hover:bg-slate-800 gap-3 px-8 h-12 font-black shadow-xl shadow-slate-900/10 min-w-[220px]"
            >
              {generateClaimMutation.isPending ? (
                <CircleNotch size={20} className="animate-spin" weight="bold" />
              ) : (
                <DownloadSimple size={20} weight="bold" />
              )}
              {generateClaimMutation.isPending
                ? "Generating..."
                : "Finalize & Export"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
