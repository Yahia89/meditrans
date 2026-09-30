import { lazy, Suspense, useState } from "react";
import { CircleNotch, ChartLineUp, ArrowUpRight } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useAuth } from "@/contexts/auth-context";
import { getActiveTimezone, formatInUserTimezone } from "@/lib/timezone";
import { getPerformanceRange, buildChartPoints, type TripBucket, type TimeRange } from "./tripBuckets";
import { useOnboarding } from "@/contexts/OnboardingContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const PerformanceChartPlot = lazy(() => import("./PerformanceChartPlot"));

export function PerformanceChart() {
  const { currentOrganization } = useOrganization();
  const { navigateTo } = useOnboarding();
  const { profile } = useAuth();
  const timezone = getActiveTimezone(profile, currentOrganization);
  const [timeRange, setTimeRange] = useState<TimeRange>("weekly");

  const today = formatInUserTimezone(new Date(), timezone, "yyyy-MM-dd");
  const range = getPerformanceRange(today, timeRange, timezone);
  const { data: buckets = [], isLoading, isError } = useQuery({
    queryKey: ["trips", currentOrganization?.id, "dashboard", "performance", timezone, today, timeRange],
    queryFn: async ({ signal }) => {
      const { data, error } = await supabase.rpc("dashboard_trip_buckets", {
        p_org_id: currentOrganization!.id,
        p_start: range.start,
        p_end: range.end,
        p_timezone: timezone,
        p_granularity: timeRange === "daily" ? "hour" : "day",
      }).abortSignal(signal);
      if (error) throw error;
      return data as TripBucket[];
    },
    enabled: !!currentOrganization?.id,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
  const chartData = buildChartPoints(range.days, timeRange, buckets);
  const hasData = chartData.some((point) => point.total > 0);

  return (
    <div
      onClick={() => navigateTo("trips")}
      className="bg-white rounded-2xl p-6 md:p-8 border border-slate-100 shadow-sm transition-all hover:shadow-md hover:border-lime-200 cursor-pointer lg:col-span-3 group relative overflow-hidden"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-xl font-bold text-slate-900">
              Fleet Performance
            </h2>
            <ArrowUpRight
              size={18}
              className="text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity"
            />
          </div>
          <p className="text-sm text-slate-500">
            Trip volume and status breakdown
          </p>
        </div>

        <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
          <Select
            value={timeRange}
            onValueChange={(val: TimeRange) => setTimeRange(val)}
          >
            <SelectTrigger className="w-[180px] h-9 text-xs font-medium bg-slate-50 border-slate-200 rounded-lg focus:ring-lime-500/20">
              <SelectValue placeholder="Select range" />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectItem value="daily">Daily (24h)</SelectItem>
              <SelectItem value="weekly">Weekly (7d)</SelectItem>
              <SelectItem value="biweekly">Bi-Weekly (14d)</SelectItem>
              <SelectItem value="monthly">Monthly (30d)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="h-[300px] lg:h-[450px] w-full mt-4">
        {isLoading ? (
          <div className="h-full flex items-center justify-center">
            <CircleNotch size={32} className="animate-spin text-slate-300" />
          </div>
        ) : isError ? (
          <p role="alert" className="pt-12 text-center text-sm text-slate-500">Unable to load fleet performance. Please try again.</p>
        ) : !hasData ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
              <ChartLineUp size={32} className="text-slate-300" />
            </div>
            <p className="text-slate-500 font-medium">
              No trip data for this period
            </p>
            <p className="text-sm text-slate-400">
              Change the time range or schedule new trips
            </p>
          </div>
        ) : (
          <Suspense fallback={<div className="h-full flex items-center justify-center"><CircleNotch size={32} className="animate-spin text-slate-300" /></div>}>
            <PerformanceChartPlot chartData={chartData} timeRange={timeRange} />
          </Suspense>
        )}
      </div>
    </div>
  );
}
