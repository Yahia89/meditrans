import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { dashboardClient } from "../dashboard/dashboard-client";
import { useAuth } from "@/contexts/auth-context";
import { useOrganization } from "@/contexts/OrganizationContext";
import { getActiveTimezone } from "@/lib/timezone";
import { buildCreditAlerts, creditAlertQueryOptions, getCreditMonth, normalizeCreditFees } from "./credit-alert-data";

export function useCreditAlerts() {
  const { user, profile } = useAuth();
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;
  const userId = user?.id;
  const timezone = getActiveTimezone(profile, currentOrganization);
  const month = getCreditMonth(new Date(), timezone);
  const scope = userId && orgId ? { userId, orgId, timezone, ...month } : null;
  const balances = useQuery(creditAlertQueryOptions(dashboardClient, scope));
  // Fees and balances start independently. Derive alerts only after both resolve,
  // and recompute immediately when fee settings are invalidated.
  const fees = useQuery({
    queryKey: ["organization_fees", orgId, userId],
    queryFn: async ({ signal }) => {
      if (!orgId || !userId) throw new Error("An authenticated organization is required");
      const { data, error } = await dashboardClient.from("organization_fees")
        .select("base_fee, per_mile_fee, deadhead_per_mile_ambulatory, foldable_wheelchair_base_fee, foldable_wheelchair_per_mile_fee, foldable_wheelchair_deadhead_fee, wheelchair_base_fee, wheelchair_per_mile_fee, wheelchair_deadhead_fee, ramp_van_base_fee, ramp_van_per_mile_fee, ramp_van_deadhead_fee, wait_time_free_minutes, wait_time_hourly_rate, custom_charges")
        .eq("org_id", orgId).abortSignal(signal).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: scope !== null,
    staleTime: 60_000,
  });
  const data = useMemo(() => balances.data && fees.data !== undefined
    ? buildCreditAlerts(balances.data.patients, balances.data.trips, normalizeCreditFees(fees.data))
    : [], [balances.data, fees.data]);
  return {
    data,
    isLoading: balances.isPending || fees.isPending,
    isError: balances.isError || fees.isError,
  };
}
