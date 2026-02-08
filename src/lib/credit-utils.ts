export type CreditStatus = "good" | "mid" | "low" | "none";

export interface CreditInfo {
  status: CreditStatus;
  percentage: number;
  label: string;
  colorClass: string;
  bgClass: string;
}

export function calculateCreditStatus(
  monthlyCredit: number | null,
  spentAmount: number,
): CreditInfo {
  if (!monthlyCredit || monthlyCredit <= 0) {
    return {
      status: "none",
      percentage: 0,
      label: "No Credit Set",
      colorClass: "text-slate-600",
      bgClass: "bg-slate-100",
    };
  }

  const remaining = monthlyCredit - spentAmount;
  const percentage = (remaining / monthlyCredit) * 100;

  if (percentage <= 5) {
    return {
      status: "low",
      percentage: Math.max(0, percentage),
      label: "Low Credit",
      colorClass: "text-red-700",
      bgClass: "bg-red-100",
    };
  }

  if (percentage <= 50) {
    return {
      status: "mid",
      percentage,
      label: "Medium Credit",
      colorClass: "text-amber-700",
      bgClass: "bg-amber-100",
    };
  }

  return {
    status: "good",
    percentage,
    label: "Good Credit",
    colorClass: "text-emerald-700",
    bgClass: "bg-emerald-100",
  };
}

export interface OrganizationFees {
  base_fee: number;
  per_mile_fee: number;
  deadhead_per_mile_ambulatory: number;

  foldable_wheelchair_base_fee: number;
  foldable_wheelchair_per_mile_fee: number;
  foldable_wheelchair_deadhead_fee: number;

  wheelchair_base_fee: number;
  wheelchair_per_mile_fee: number;
  wheelchair_deadhead_fee: number;
  deadhead_per_mile_wheelchair?: number; // Legacy support

  ramp_van_base_fee: number;
  ramp_van_per_mile_fee: number;
  ramp_van_deadhead_fee: number;

  wait_time_free_minutes: number;
  wait_time_hourly_rate: number;

  custom_charges?: Array<{
    name: string;
    amount: number;
    is_per_mile: boolean;
  }>;
}

export const DEFAULT_FEES: OrganizationFees = {
  base_fee: 26,
  per_mile_fee: 2,
  deadhead_per_mile_ambulatory: 1,

  foldable_wheelchair_base_fee: 35,
  foldable_wheelchair_per_mile_fee: 2.5,
  foldable_wheelchair_deadhead_fee: 1.25,

  wheelchair_base_fee: 40,
  wheelchair_per_mile_fee: 3,
  wheelchair_deadhead_fee: 1.5,

  ramp_van_base_fee: 55,
  ramp_van_per_mile_fee: 4,
  ramp_van_deadhead_fee: 2,

  wait_time_free_minutes: 45,
  wait_time_hourly_rate: 55,
  custom_charges: [],
};

export function calculateTripCost(
  trip: any,
  fees: OrganizationFees | null,
): number {
  const activeFees = fees || DEFAULT_FEES;

  const tripType = (trip.trip_type || "").toUpperCase();

  let base = Number(activeFees.base_fee) || DEFAULT_FEES.base_fee;
  let perMileRate =
    Number(activeFees.per_mile_fee) || DEFAULT_FEES.per_mile_fee;

  if (tripType.includes("FOLDABLE")) {
    base =
      Number(activeFees.foldable_wheelchair_base_fee) ||
      DEFAULT_FEES.foldable_wheelchair_base_fee;
    perMileRate =
      Number(activeFees.foldable_wheelchair_per_mile_fee) ||
      DEFAULT_FEES.foldable_wheelchair_per_mile_fee;
  } else if (tripType.includes("RAMP") || tripType.includes("VAN")) {
    base =
      Number(activeFees.ramp_van_base_fee) || DEFAULT_FEES.ramp_van_base_fee;
    perMileRate =
      Number(activeFees.ramp_van_per_mile_fee) ||
      DEFAULT_FEES.ramp_van_per_mile_fee;
  } else if (tripType.includes("WHEELCHAIR") || tripType.includes("STRETCH")) {
    base =
      Number(activeFees.wheelchair_base_fee) ||
      DEFAULT_FEES.wheelchair_base_fee;
    perMileRate =
      Number(activeFees.wheelchair_per_mile_fee) ||
      DEFAULT_FEES.wheelchair_per_mile_fee;
  }

  // Use actual distance if available, otherwise scheduled distance, otherwise 0
  const distance =
    Number(trip.actual_distance_miles) || Number(trip.distance_miles) || 0;
  const mileageCost = distance * perMileRate;

  // Wait time calculation
  const waitMinutes = Number(trip.total_waiting_minutes) || 0;
  const freeMinutes =
    Number(activeFees.wait_time_free_minutes) ||
    DEFAULT_FEES.wait_time_free_minutes;
  const hourlyRate =
    Number(activeFees.wait_time_hourly_rate) ||
    DEFAULT_FEES.wait_time_hourly_rate;

  const billableWait = Math.max(0, waitMinutes - freeMinutes);
  const waitCost = (billableWait / 60) * hourlyRate;

  // Add custom charges
  let customTotal = 0;
  if (activeFees.custom_charges && Array.isArray(activeFees.custom_charges)) {
    activeFees.custom_charges.forEach((charge) => {
      if (charge.is_per_mile) {
        customTotal += (Number(charge.amount) || 0) * distance;
      } else {
        customTotal += Number(charge.amount) || 0;
      }
    });
  }

  return base + mileageCost + waitCost + customTotal;
}

export const ESTIMATED_COST_PER_TRIP = 50;
