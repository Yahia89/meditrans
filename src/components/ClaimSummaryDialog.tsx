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
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertTriangle,
  Loader2,
  FileText,
  User,
  Calendar,
  Check,
  X,
  RefreshCw,
  Download,
} from "lucide-react";
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

      // Get trips that are completed and not already billed
      const { data: trips, error } = await supabase
        .from("trips")
        .select(
          `
          *,
          patient:patients(*),
          driver:drivers(*)
        `
        )
        .eq("status", "completed")
        .order("scheduled_date", { ascending: false });

      if (error) throw error;

      // Filter out trips that already have an 'included' claim line
      const { data: claimLines } = await supabase
        .from("billing_claim_lines")
        .select("trip_id")
        .eq("status", "included");

      const billedTripIds = new Set(claimLines?.map((l) => l.trip_id) || []);

      return trips
        .filter((t) => !billedTripIds.has(t.id))
        .map((trip) => {
          // Normalize trip for validation
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
          };

          const errors = validateTrip(
            validationTrip as any,
            currentOrganization as any
          );
          return {
            ...trip,
            errors,
            isValid: errors.length === 0,
          };
        });
    },
    enabled: !!currentOrganization?.id && open,
  });

  const validTrips = useMemo(
    () => billableTrips?.filter((t) => t.isValid) || [],
    [billableTrips]
  );
  const invalidTrips = useMemo(
    () => billableTrips?.filter((t) => !t.isValid) || [],
    [billableTrips]
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

  // Mutation to generate the claim
  const generateClaimMutation = useMutation({
    mutationFn: async () => {
      if (!currentOrganization?.id || selectedTrips.size === 0) return;

      const tripsToBill =
        billableTrips?.filter((t) => selectedTrips.has(t.id)) || [];

      // 1. Create the claim record
      const claimControlNumber = `CLM-${format(
        new Date(),
        "yyyyMMdd"
      )}-${Math.random().toString(36).substring(7).toUpperCase()}`;

      const { data: claim, error: claimError } = await supabase
        .from("billing_claims")
        .insert({
          org_id: currentOrganization.id,
          claim_control_number: claimControlNumber,
          status: "draft",
          billing_period_start:
            tripsToBill[tripsToBill.length - 1].scheduled_date,
          billing_period_end: tripsToBill[0].scheduled_date,
          total_charge: 0, // Will update after lines are added
          total_trips: tripsToBill.length,
        })
        .select()
        .single();

      if (claimError) throw claimError;

      // 2. Map trips to claim lines and calculate totals
      let totalCharge = 0;
      const lines = tripsToBill.flatMap((trip) => {
        const vehicleType = determineVehicleType(trip.vehicle_type);
        const codes = getHCPCSCodes(
          currentOrganization.billing_state as "MN" | "CA",
          vehicleType
        );

        // Base line
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

        // Mileage line (if miles > 0)
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

      // 3. Update claim total and status
      const { error: updateError } = await supabase
        .from("billing_claims")
        .update({ total_charge: totalCharge, status: "generated" })
        .eq("id", claim.id);

      if (updateError) throw updateError;

      // 4. Generate the 837P file
      const claimData = {
        organization: {
          ...currentOrganization,
          billing_state: currentOrganization.billing_state,
        },
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
            vehicleType
          );
          const { charge: mileageAmount } = calculateMileageCharge(
            t.actual_distance_miles || 0,
            DEFAULT_RATES[mileage.code] || 2.0
          );

          return {
            patientName: `${t.patient.first_name} ${t.patient.last_name}`,
            patientDOB: t.patient.date_of_birth,
            medicaidId: t.patient.medicaid_id!,
            serviceDate: t.scheduled_date,
            hcpcsCode: base.code,
            units: 1,
            chargeAmount: (DEFAULT_RATES[base.code] || 25.0) + mileageAmount,
            diagnosisCode: "Z00.00", // Default diagnosis
            pickupAddress: t.pickup_location,
            dropoffAddress: t.dropoff_location,
            driverName: t.driver
              ? `${t.driver.first_name} ${t.driver.last_name}`
              : "Unknown Driver",
            driverUMPI: t.driver?.umpi,
            driverNPI: t.driver?.npi,
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
      <DialogContent className="max-w-4xl w-[95vw] h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 border-b shrink-0">
          <DialogTitle className="text-2xl flex items-center gap-2">
            <FileText className="text-emerald-600" />
            Generate Claim Batch
          </DialogTitle>
          <DialogDescription>
            Selected {selectedTrips.size} trips for submission to{" "}
            {currentOrganization?.billing_state}.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col p-6 space-y-6">
          {isLoading ? (
            <div className="flex-1 flex flex-center flex-col items-center justify-center space-y-4">
              <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
              <p className="text-slate-500 font-medium tracking-wide">
                Scanning recent trip activity...
              </p>
            </div>
          ) : isError ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4">
              <div className="bg-red-50 p-4 rounded-full">
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">
                Failed to fetch trips
              </h3>
              <p className="text-slate-500 max-w-sm">
                There was an error loading the billable trips. Please check your
                connection and try again.
              </p>
              <Button
                onClick={() => refetch()}
                variant="outline"
                className="gap-2"
              >
                <RefreshCw className="w-4 h-4" /> Retry
              </Button>
            </div>
          ) : (
            <>
              {/* Stats Summary */}
              <div className="flex gap-4">
                <div className="flex-1 bg-slate-50 rounded-2xl p-4 border border-slate-100 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Billable Trips
                    </p>
                    <p className="text-2xl font-bold text-slate-900">
                      {validTrips.length}
                    </p>
                  </div>
                  <div className="bg-emerald-100 text-emerald-600 p-2 rounded-xl">
                    <Check className="w-5 h-5" />
                  </div>
                </div>
                <div className="flex-1 bg-slate-50 rounded-2xl p-4 border border-slate-100 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Invalid / Incomplete
                    </p>
                    <p className="text-2xl font-bold text-slate-900">
                      {invalidTrips.length}
                    </p>
                  </div>
                  <div className="bg-amber-100 text-amber-600 p-2 rounded-xl">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                </div>
              </div>

              {/* Action Bar */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={selectAll}
                    className="text-xs font-bold uppercase tracking-wider h-8 px-3"
                  >
                    {selectedTrips.size === validTrips.length
                      ? "Deselect All"
                      : "Select All Valid"}
                  </Button>
                </div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Showing {billableTrips?.length || 0} recent completed trips
                </p>
              </div>

              {/* Trip List */}
              <ScrollArea className="flex-1 border border-slate-100 rounded-2xl bg-white shadow-sm overflow-auto">
                <div className="divide-y divide-slate-100">
                  {billableTrips?.length === 0 ? (
                    <div className="py-20 text-center">
                      <p className="text-slate-400 font-medium">
                        No completed trips found for billing.
                      </p>
                    </div>
                  ) : (
                    billableTrips?.map((trip) => (
                      <div
                        key={trip.id}
                        className={`p-4 flex items-center gap-4 transition-all hover:bg-slate-50/80 cursor-pointer ${
                          !trip.isValid ? "opacity-60 cursor-not-allowed" : ""
                        }`}
                        onClick={() => toggleTrip(trip.id, trip.isValid)}
                      >
                        <div className="shrink-0">
                          {trip.isValid ? (
                            <div
                              className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                                selectedTrips.has(trip.id)
                                  ? "bg-emerald-600 border-emerald-600"
                                  : "border-slate-300"
                              }`}
                            >
                              {selectedTrips.has(trip.id) && (
                                <Check className="w-4 h-4 text-white" />
                              )}
                            </div>
                          ) : (
                            <X className="w-6 h-6 text-slate-300" />
                          )}
                        </div>

                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            <p className="text-sm font-bold text-slate-900 truncate">
                              {trip.patient.first_name} {trip.patient.last_name}
                            </p>
                            <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-mono">
                              ID: {trip.patient.medicaid_id || "MISSING"}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-[11px] text-slate-500">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />{" "}
                              {format(
                                new Date(trip.scheduled_date),
                                "MMM d, yyyy"
                              )}
                            </span>
                            <span className="flex items-center gap-1 uppercase tracking-wider font-semibold">
                              {trip.vehicle_type}
                            </span>
                            <span className="text-slate-400">|</span>
                            <span>{trip.actual_distance_miles || 0} miles</span>
                          </div>
                        </div>

                        <div className="shrink-0 flex flex-col items-end gap-1">
                          {trip.isValid ? (
                            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                              VALIDATED
                            </span>
                          ) : (
                            <div className="flex flex-col items-end">
                              <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                                NEEDS ATTENTION
                              </span>
                              <p className="text-[9px] text-red-400 mt-1 max-w-[150px] text-right truncate">
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

        <DialogFooter className="p-6 border-t bg-slate-50/50 shrink-0 flex items-center justify-between">
          <div className="hidden sm:block">
            <p className="text-sm font-medium text-slate-500">
              {selectedTrips.size} of {validTrips.length} valid trips selected
            </p>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1 sm:flex-none"
            >
              Cancel
            </Button>
            <Button
              disabled={
                selectedTrips.size === 0 || generateClaimMutation.isPending
              }
              onClick={() => generateClaimMutation.mutate()}
              className="flex-1 sm:flex-none bg-slate-900 text-white hover:bg-slate-800 gap-2 min-w-[180px]"
            >
              {generateClaimMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Generate 837P Export
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
