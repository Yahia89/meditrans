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
  wheelchair_base_fee: number;
  wheelchair_per_mile_fee: number;
  deadhead_per_mile_ambulatory: number;
  deadhead_per_mile_wheelchair: number;
  wait_time_free_minutes: number;
  wait_time_hourly_rate: number;
}

export function calculateTripCost(
  trip: any,
  fees: OrganizationFees | null,
): number {
  if (!fees) return ESTIMATED_COST_PER_TRIP;

  const tripType = (trip.trip_type || "").toLowerCase();
  const isWheelchair =
    tripType.includes("wheelchair") ||
    tripType.includes("ramp") ||
    tripType.includes("stretch");

  const base = isWheelchair
    ? Number(fees.wheelchair_base_fee) || 0
    : Number(fees.base_fee) || 0;

  const perMileRate = isWheelchair
    ? Number(fees.wheelchair_per_mile_fee) || 0
    : Number(fees.per_mile_fee) || 0;

  // Use actual distance if available, otherwise scheduled distance, otherwise 0
  const distance =
    Number(trip.actual_distance_miles) || Number(trip.distance_miles) || 0;
  const mileageCost = distance * perMileRate;

  // Wait time calculation (Wait Time Hourly Rate / 60 * (total_wait - free_minutes))
  const waitMinutes = Number(trip.total_waiting_minutes) || 0;
  const freeMinutes = Number(fees.wait_time_free_minutes) || 45;
  const hourlyRate = Number(fees.wait_time_hourly_rate) || 55;

  const billableWait = Math.max(0, waitMinutes - freeMinutes);
  const waitCost = (billableWait / 60) * hourlyRate;

  return base + mileageCost + waitCost;
}

export const ESTIMATED_COST_PER_TRIP = 50;
