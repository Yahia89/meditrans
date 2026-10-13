import { queryOptions } from "@tanstack/react-query";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addMonths, format, parseISO } from "date-fns";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import type { Database, Json } from "../../types/supabase.ts";
import { calculateCreditStatus, calculateTripCost, DEFAULT_FEES, type OrganizationFees } from "../../lib/credit-utils.ts";

type Patient = Pick<Database["public"]["Tables"]["patients"]["Row"], "id" | "full_name" | "monthly_credit">;
type CreditTrip = Pick<Database["public"]["Tables"]["trips"]["Row"], "id" | "patient_id" | "status" | "trip_type" | "actual_distance_miles" | "distance_miles" | "total_waiting_minutes">;
type FeeRow = Pick<Database["public"]["Tables"]["organization_fees"]["Row"], Exclude<keyof OrganizationFees, "deadhead_per_mile_wheelchair">>;

export interface CreditAlert {
  id: string;
  patientName: string;
  monthlyCredit: number;
  remainingBalance: number;
  percentRemaining: number;
  severity: "expired" | "critical" | "warning";
}

export interface CreditAlertScope {
  userId: string;
  orgId: string;
  month: string;
  timezone: string;
  start: string;
  end: string;
}

export function getCreditMonth(now: Date, timezone: string) {
  const month = formatInTimeZone(now, timezone, "yyyy-MM");
  const firstDay = `${month}-01`;
  const nextMonth = format(addMonths(parseISO(firstDay), 1), "yyyy-MM-dd");
  return {
    month,
    start: fromZonedTime(`${firstDay}T00:00:00`, timezone).toISOString(),
    end: fromZonedTime(`${nextMonth}T00:00:00`, timezone).toISOString(),
  };
}

// Read the exact total on the first page so even a server with a smaller row cap
// cannot silently turn an incomplete balance into a healthy-credit message.
export async function readCreditPages<T>(load: (from: number, to: number, count: boolean) => PromiseLike<{
  data: T[] | null;
  error: { message: string } | null;
  count: number | null;
}>): Promise<T[]> {
  const rows: T[] = [];
  let total: number | null = null;
  while (true) {
    const { data, error, count } = await load(rows.length, rows.length + 499, rows.length === 0);
    if (error) throw error;
    if (total === null) total = count;
    const page = data ?? [];
    rows.push(...page);
    if (total !== null && rows.length >= total) return rows;
    if (page.length === 0) {
      if (total !== null && rows.length < total) throw new Error("Credit data changed while loading. Please retry.");
      return rows;
    }
    if (total === null && page.length < 500) return rows;
  }
}

export function creditAlertQueryOptions(client: SupabaseClient<Database>, scope: CreditAlertScope | null) {
  return queryOptions({
    // Retain this prefix for existing credit-entry/client mutation invalidations.
    queryKey: ["low-balance-patients", scope?.orgId, scope?.userId, scope?.month, scope?.timezone],
    queryFn: async ({ signal }) => {
      if (!scope) throw new Error("An authenticated organization is required");
      const [patients, trips] = await Promise.all([
        readCreditPages((from, to, count) => client.from("patients")
          .select("id, full_name, monthly_credit", count ? { count: "exact" } : {})
          .eq("org_id", scope.orgId).not("monthly_credit", "is", null)
          .order("id").range(from, to).abortSignal(signal)),
        readCreditPages((from, to, count) => client.from("trips")
          .select("id, patient_id, status, trip_type, actual_distance_miles, distance_miles, total_waiting_minutes", count ? { count: "exact" } : {})
          .eq("org_id", scope.orgId).eq("status", "completed")
          .gte("pickup_time", scope.start).lt("pickup_time", scope.end)
          .order("id").range(from, to).abortSignal(signal)),
      ]);
      return { patients, trips };
    },
    enabled: scope !== null,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

function customCharges(value: Json | null): OrganizationFees["custom_charges"] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((charge) => {
    if (!charge || typeof charge !== "object" || Array.isArray(charge)
      || typeof charge.name !== "string" || typeof charge.amount !== "number"
      || typeof charge.is_per_mile !== "boolean") return [];
    return [{ name: charge.name, amount: charge.amount, is_per_mile: charge.is_per_mile }];
  });
}

export function normalizeCreditFees(fees: FeeRow | null): OrganizationFees | null {
  if (!fees) return null;
  return {
    base_fee: fees.base_fee ?? DEFAULT_FEES.base_fee,
    per_mile_fee: fees.per_mile_fee ?? DEFAULT_FEES.per_mile_fee,
    deadhead_per_mile_ambulatory: fees.deadhead_per_mile_ambulatory ?? DEFAULT_FEES.deadhead_per_mile_ambulatory,
    foldable_wheelchair_base_fee: fees.foldable_wheelchair_base_fee ?? DEFAULT_FEES.foldable_wheelchair_base_fee,
    foldable_wheelchair_per_mile_fee: fees.foldable_wheelchair_per_mile_fee ?? DEFAULT_FEES.foldable_wheelchair_per_mile_fee,
    foldable_wheelchair_deadhead_fee: fees.foldable_wheelchair_deadhead_fee ?? DEFAULT_FEES.foldable_wheelchair_deadhead_fee,
    wheelchair_base_fee: fees.wheelchair_base_fee ?? DEFAULT_FEES.wheelchair_base_fee,
    wheelchair_per_mile_fee: fees.wheelchair_per_mile_fee ?? DEFAULT_FEES.wheelchair_per_mile_fee,
    wheelchair_deadhead_fee: fees.wheelchair_deadhead_fee ?? DEFAULT_FEES.wheelchair_deadhead_fee,
    ramp_van_base_fee: fees.ramp_van_base_fee ?? DEFAULT_FEES.ramp_van_base_fee,
    ramp_van_per_mile_fee: fees.ramp_van_per_mile_fee ?? DEFAULT_FEES.ramp_van_per_mile_fee,
    ramp_van_deadhead_fee: fees.ramp_van_deadhead_fee ?? DEFAULT_FEES.ramp_van_deadhead_fee,
    wait_time_free_minutes: fees.wait_time_free_minutes ?? DEFAULT_FEES.wait_time_free_minutes,
    wait_time_hourly_rate: fees.wait_time_hourly_rate ?? DEFAULT_FEES.wait_time_hourly_rate,
    custom_charges: customCharges(fees.custom_charges),
  };
}

export function buildCreditAlerts(patients: Patient[], trips: CreditTrip[], fees: OrganizationFees | null): CreditAlert[] {
  const spentByPatient = new Map<string, number>();
  for (const trip of trips) {
    if (trip.patient_id) spentByPatient.set(trip.patient_id, (spentByPatient.get(trip.patient_id) ?? 0) + calculateTripCost(trip, fees));
  }
  return patients.flatMap((patient): CreditAlert[] => {
    const spent = spentByPatient.get(patient.id) ?? 0;
    const credit = patient.monthly_credit ?? 0;
    const info = calculateCreditStatus(credit, spent);
    if (info.status === "good" || info.status === "none") return [];
    const percentRemaining = info.percentage / 100;
    return [{
      id: patient.id,
      patientName: patient.full_name,
      monthlyCredit: credit,
      remainingBalance: credit - spent,
      percentRemaining,
      severity: percentRemaining <= 0.05 ? "expired" : percentRemaining <= 0.25 ? "critical" : "warning",
    }];
  }).sort((a, b) => a.percentRemaining - b.percentRemaining);
}
