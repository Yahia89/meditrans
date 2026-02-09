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
  // Common Carrier (Ambulatory): $26 pickup, $2/mile, $1 deadhead
  base_fee: 26,
  per_mile_fee: 2,
  deadhead_per_mile_ambulatory: 1,

  // Foldable Wheelchair: $40 pickup, $3/mile, $1.50 deadhead
  foldable_wheelchair_base_fee: 40,
  foldable_wheelchair_per_mile_fee: 3,
  foldable_wheelchair_deadhead_fee: 1.5,

  // Standard Wheelchair: $40 pickup, $3/mile, $1.50 deadhead
  wheelchair_base_fee: 40,
  wheelchair_per_mile_fee: 3,
  wheelchair_deadhead_fee: 1.5,

  // Ramp Van: $40 pickup, $3/mile, $1.50 deadhead (same as wheelchair)
  ramp_van_base_fee: 40,
  ramp_van_per_mile_fee: 3,
  ramp_van_deadhead_fee: 1.5,

  // Wait time: $55/hr after first 45 mins free
  wait_time_free_minutes: 45,
  wait_time_hourly_rate: 55,
  custom_charges: [],
};

export function calculateTripCost(
  trip: any,
  fees: OrganizationFees | null,
): number {
  const activeFees = fees || DEFAULT_FEES;

  // Prefer billing_details.service_type if available, else fallback to trip_type
  const serviceType = (trip.billing_details?.service_type || "").toLowerCase();
  const tripType = (trip.trip_type || "").toUpperCase();

  let base = Number(activeFees.base_fee) || DEFAULT_FEES.base_fee;
  let perMileRate =
    Number(activeFees.per_mile_fee) || DEFAULT_FEES.per_mile_fee;

  // Check service_type from billing_details first (new system)
  if (serviceType === "foldable wheelchair") {
    base =
      Number(activeFees.foldable_wheelchair_base_fee) ||
      DEFAULT_FEES.foldable_wheelchair_base_fee;
    perMileRate =
      Number(activeFees.foldable_wheelchair_per_mile_fee) ||
      DEFAULT_FEES.foldable_wheelchair_per_mile_fee;
  } else if (serviceType === "wheelchair") {
    base =
      Number(activeFees.wheelchair_base_fee) ||
      DEFAULT_FEES.wheelchair_base_fee;
    perMileRate =
      Number(activeFees.wheelchair_per_mile_fee) ||
      DEFAULT_FEES.wheelchair_per_mile_fee;
  } else if (serviceType === "ramp van") {
    base =
      Number(activeFees.ramp_van_base_fee) || DEFAULT_FEES.ramp_van_base_fee;
    perMileRate =
      Number(activeFees.ramp_van_per_mile_fee) ||
      DEFAULT_FEES.ramp_van_per_mile_fee;
  } else if (serviceType === "ambulatory" || serviceType) {
    // Ambulatory uses default (base) fees, do nothing
  } else {
    // Fallback: check trip_type for legacy trips without billing_details
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
    } else if (
      tripType.includes("WHEELCHAIR") ||
      tripType.includes("STRETCH")
    ) {
      base =
        Number(activeFees.wheelchair_base_fee) ||
        DEFAULT_FEES.wheelchair_base_fee;
      perMileRate =
        Number(activeFees.wheelchair_per_mile_fee) ||
        DEFAULT_FEES.wheelchair_per_mile_fee;
    }
  }

  // Use actual distance if available, otherwise scheduled distance, otherwise 0
  const distance =
    Number(trip.actual_distance_miles) || Number(trip.distance_miles) || 0;
  const mileageCost = distance * perMileRate;

  // Wait time calculation
  // Business rule: First 45 minutes free, then charge flat $55 if exceeded
  const waitMinutes = Number(trip.total_waiting_minutes) || 0;
  const freeMinutes =
    Number(activeFees.wait_time_free_minutes) ||
    DEFAULT_FEES.wait_time_free_minutes;
  const waitFlatRate =
    Number(activeFees.wait_time_hourly_rate) ||
    DEFAULT_FEES.wait_time_hourly_rate;

  // If wait exceeds free allowance, charge the flat rate (not pro-rated)
  const waitCost = waitMinutes > freeMinutes ? waitFlatRate : 0;

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

  // Round to 2 decimal places to avoid floating point precision issues
  const total = base + mileageCost + waitCost + customTotal;

  // Debug logging for troubleshooting
  if (process.env.NODE_ENV === "development") {
    console.debug(`[calculateTripCost] Trip ID: ${trip.id}`, {
      detectedServiceType: serviceType || "(empty - using tripType fallback)",
      tripType,
      rates: { base, perMileRate },
      distance,
      mileageCost,
      waitMinutes,
      waitExceedsFree: waitMinutes > freeMinutes,
      waitCost,
      customTotal,
      total: Math.round(total * 100) / 100,
    });
  }

  return Math.round(total * 100) / 100;
}

export const ESTIMATED_COST_PER_TRIP = 50;
