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
  spentAmount: number
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

export const ESTIMATED_COST_PER_TRIP = 50;
