import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { REFERRAL_SOURCES } from "@/lib/constants";
import { fromZonedTime } from "date-fns-tz";
import {
  normalizeReferredBy,
  isConnectAbilityReferrer,
  CONNECTABILITY_CANONICAL,
} from "./connectability-utils";
import { type OrganizationFees } from "@/lib/credit-utils";
import type { SummaryTrip, FilterState, MultiSelectOption } from "./types";

interface UseSummaryDataParams {
  orgId: string | undefined;
  filters: FilterState;
  patientId?: string;
  driverId?: string;
  timezone: string;
}

export function useSummaryData({ orgId, filters, patientId, driverId, timezone }: UseSummaryDataParams) {
  const [trips, setTrips] = useState<SummaryTrip[]>([]);
  const [matchedPatientCount, setMatchedPatientCount] = useState(0);
  const [isFetching, setIsFetching] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);

  // Dynamic "Referred By" options from the database
  const [referredByOptions, setReferredByOptions] = useState<MultiSelectOption[]>([]);
  const [referredByLoading, setReferredByLoading] = useState(false);

  // Organization fee schedule (used for cost calculation in ConnectAbility PDFs)
  const [orgFees, setOrgFees] = useState<OrganizationFees | null>(null);

  // ConnectAbility patient list (full names) — populated after a generate so the
  // user can check/uncheck individual patients for per-patient PDFs.
  const [connectAbilityPatients, setConnectAbilityPatients] = useState<string[]>([]);

  // Fetch org fees once per org
  useEffect(() => {
    if (!orgId) return;
    const fetchFees = async () => {
      try {
        const { data, error } = await supabase
          .from("organization_fees" as any)
          .select("*")
          .eq("org_id", orgId)
          .single();
        if (error && (error as any).code !== "PGRST116") throw error;
        if (data) setOrgFees(data as OrganizationFees);
      } catch {
        // Non-critical: fall back to DEFAULT_FEES in the PDF generator
      }
    };
    fetchFees();
  }, [orgId]);

  // Fetch all unique referral_by values from the patients table
  // This aggregates both standard values AND custom "Other" entries
  useEffect(() => {
    if (!orgId) return;

    const fetchReferralSources = async () => {
      setReferredByLoading(true);
      try {
        const { data, error } = await (supabase
          .from("patients" as any) as any)
          .select("referral_by")
          .eq("org_id", orgId)
          .not("referral_by", "is", null)
          .not("referral_by", "eq", "");

        if (error) throw error;

        // Aggregate unique values, normalizing ConnectAbility variants → canonical label
        const uniqueValues = new Set<string>();
        (data as any[] || []).forEach((p: { referral_by: string }) => {
          if (p.referral_by) {
            uniqueValues.add(normalizeReferredBy(p.referral_by) ?? p.referral_by);
          }
        });

        // Also include the standard referral sources to ensure they always appear
        (REFERRAL_SOURCES as unknown as any[]).forEach((s) => {
          if (s !== "Other") {
            uniqueValues.add(s);
          }
        });

        // Always include the canonical ConnectAbility label
        uniqueValues.add(CONNECTABILITY_CANONICAL);

        // Sort: standard sources first, then custom ones alphabetically
        const standardSet = new Set(REFERRAL_SOURCES.filter((s) => s !== "Other") as unknown as any[]);
        const sorted = Array.from(uniqueValues).sort((a, b) => {
          const aStd = standardSet.has(a);
          const bStd = standardSet.has(b);
          if (aStd && !bStd) return -1;
          if (!aStd && bStd) return 1;
          return a.localeCompare(b);
        });

        setReferredByOptions(
          sorted.map((v) => ({
            value: v,
            label: v,
          })),
        );
      } catch (err) {
        console.error("Failed to fetch referral sources:", err);
        // Fallback to static list
        setReferredByOptions(
          REFERRAL_SOURCES.filter((s) => s !== "Other").map((s) => ({
            value: s,
            label: s,
          })),
        );
      } finally {
        setReferredByLoading(false);
      }
    };

    fetchReferralSources();
  }, [orgId]);

  const hasFilters =
    filters.selectedVehicleTypes.length > 0 ||
    filters.selectedWaiverTypes.length > 0 ||
    filters.selectedReferredBy.length > 0 ||
    filters.selectedSalStatuses.length > 0 ||
    filters.selectedTripPurposes.length > 0 ||
    filters.selectedTripStatuses.length > 0;

  const hasPatientFilters =
    filters.selectedVehicleTypes.length > 0 ||
    filters.selectedWaiverTypes.length > 0 ||
    filters.selectedReferredBy.length > 0 ||
    filters.selectedSalStatuses.length > 0;

  const fetchData = useCallback(async () => {
    if (!orgId) return;

    setIsFetching(true);
    setHasGenerated(true);

    try {
      // Step 1: If patient-level filters are set or a specific patientId is provided
      let patientIds: string[] | null = patientId ? [patientId] : null;

      if (!patientId && hasPatientFilters) {
        let patientQuery = (supabase
          .from("patients" as any) as any)
          .select("id")
          .eq("org_id", orgId);

        if (filters.selectedVehicleTypes.length > 0) {
          patientQuery = patientQuery.in(
            "vehicle_type_need",
            filters.selectedVehicleTypes,
          );
        }
        if (filters.selectedWaiverTypes.length > 0) {
          patientQuery = patientQuery.in(
            "waiver_type",
            filters.selectedWaiverTypes,
          );
        }
        if (filters.selectedReferredBy.length > 0) {
          // For each selected referral value, if it's the canonical ConnectAbility
          // label, expand it so the DB query matches ALL naming variants via ilike.
          const hasConnectAbility = filters.selectedReferredBy.some(
            (r) => isConnectAbilityReferrer(r)
          );
          const nonConnectAbility = filters.selectedReferredBy.filter(
            (r) => !isConnectAbilityReferrer(r)
          );

          if (hasConnectAbility && nonConnectAbility.length === 0) {
            // Only ConnectAbility selected – use ilike to match all variants
            patientQuery = patientQuery.ilike("referral_by", "%connectability%");
          } else if (hasConnectAbility && nonConnectAbility.length > 0) {
            // Mixed selection: ConnectAbility + others
            patientQuery = patientQuery.or(
              `referral_by.ilike.%connectability%,referral_by.in.(${nonConnectAbility.map((v) => `"${v}"`).join(",")})`
            );
          } else {
            // No ConnectAbility – plain in() filter
            patientQuery = patientQuery.in("referral_by", nonConnectAbility);
          }
        }
        if (filters.selectedSalStatuses.length > 0) {
          patientQuery = patientQuery.in(
            "sal_status",
            filters.selectedSalStatuses,
          );
        }

        const { data: patients, error: patErr } = await patientQuery;
        if (patErr) throw patErr;

        patientIds = (patients as any[] || []).map((p: { id: string }) => p.id);
        
        if (patientIds && patientIds.length >= 0) {
          setMatchedPatientCount(patientIds.length);
        }

        if (!patientIds || patientIds.length === 0) {
          setTrips([]);
          setConnectAbilityPatients([]);
          setIsFetching(false);
          return;
        }
      }

      // Step 2: Fetch trips
      // Use explicit timezone conversion to ensure we get exactly the dates selected by the user
      // and avoid UTC "leaks" into previous/subsequent days.
      const startTime = fromZonedTime(`${filters.startDate} 00:00:00`, timezone).toISOString();
      const endTime = fromZonedTime(`${filters.endDate} 23:59:59`, timezone).toISOString();

      let tripsQuery = (supabase
        .from("trips" as any) as any)
        .select(
          `
          *,
          patient:patients(full_name, vehicle_type_need, waiver_type, referral_by, sal_status, referral_date, referral_expiration_date),
          driver:drivers(full_name, vehicle_info)
        `,
        )
        .eq("org_id", orgId)
        .gte("pickup_time", startTime)
        .lte("pickup_time", endTime)
        .order("pickup_time", { ascending: true });

      if (patientIds) {
        tripsQuery = tripsQuery.in("patient_id", patientIds);
      }

      if (driverId) {
        tripsQuery = tripsQuery.eq("driver_id", driverId);
      }

      // Apply trip purpose filter directly on trip_type
      if (filters.selectedTripPurposes.length > 0) {
        tripsQuery = tripsQuery.in("trip_type", filters.selectedTripPurposes);
      }

      // Apply trip status filter
      if (filters.selectedTripStatuses.length > 0) {
        tripsQuery = tripsQuery.in("status", filters.selectedTripStatuses);
      }

      const { data, error } = await tripsQuery;
      if (error) throw error;

      const fetchedTrips = (data as SummaryTrip[]) || [];

      // Post-fetch: if specific CA patients are selected, filter client-side by name
      const filteredTrips =
        filters.selectedConnectAbilityPatients.length > 0
          ? fetchedTrips.filter((t) =>
              filters.selectedConnectAbilityPatients.includes(
                t.patient?.full_name || ""
              )
            )
          : fetchedTrips;

      setTrips(filteredTrips);

      // Build the unique sorted patient name list for the CA patient picker
      const patientNames = Array.from(
        new Set(fetchedTrips.map((t) => t.patient?.full_name || "Unknown"))
      ).sort((a, b) => a.localeCompare(b));
      setConnectAbilityPatients(patientNames);

      if (!hasPatientFilters) {
        setMatchedPatientCount(0);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to fetch data. Please try again.");
      setTrips([]);
      setConnectAbilityPatients([]);
    } finally {
      setIsFetching(false);
    }
  }, [orgId, filters, hasPatientFilters]);

  const resetGenerated = useCallback(() => {
    setHasGenerated(false);
    setConnectAbilityPatients([]);
  }, []);

  return {
    trips,
    matchedPatientCount,
    isFetching,
    hasGenerated,
    hasFilters,
    fetchData,
    resetGenerated,
    referredByOptions,
    referredByLoading,
    orgFees,
    connectAbilityPatients,
  };
}
