/** Checklist thresholds, not business/reporting totals. Bound work above API limits. */
export const ONBOARDING_LIMITS = { patients: 5, drivers: 5, employees: 5, trips: 1 } as const;
export interface OnboardingThresholds { patients: number; drivers: number; employees: number; trips: number }
export function onboardingDataState(counts: OnboardingThresholds): "empty" | "onboarding" | "live" {
  const totalRecords = counts.patients + counts.drivers + counts.employees;
  if (totalRecords === 0) return "empty";
  return counts.trips === 0 || totalRecords < 5 ? "onboarding" : "live";
}
