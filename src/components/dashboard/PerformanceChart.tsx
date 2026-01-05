import { useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { CircleNotch, ChartLineUp, ArrowUpRight } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useOrganization } from "@/contexts/OrganizationContext";
import {
  format,
  subDays,
  startOfDay,
  endOfDay,
  eachDayOfInterval,
  eachHourOfInterval,
  isSameDay,
  isSameHour,
} from "date-fns";
import { useOnboarding } from "@/contexts/OnboardingContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type TimeRange = "daily" | "weekly" | "biweekly" | "monthly";

export function PerformanceChart() {
  const { currentOrganization } = useOrganization();
  const { navigateTo } = useOnboarding();
  const [timeRange, setTimeRange] = useState<TimeRange>("weekly");

  const { data: chartData, isLoading } = useQuery({
    queryKey: ["performance-chart", currentOrganization?.id, timeRange],
    queryFn: async () => {
      const now = new Date();
      let start: Date;
      let end: Date = endOfDay(now);
      let intervals: Date[];
      let dateFormat: string;

      switch (timeRange) {
        case "daily":
          start = startOfDay(now);
          intervals = eachHourOfInterval({ start, end });
          dateFormat = "HH:mm";
          break;
        case "weekly":
          start = subDays(startOfDay(now), 6);
          intervals = eachDayOfInterval({ start, end });
          dateFormat = "EEE";
          break;
        case "biweekly":
          start = subDays(startOfDay(now), 13);
          intervals = eachDayOfInterval({ start, end });
          dateFormat = "dd MMM";
          break;
        case "monthly":
          start = subDays(startOfDay(now), 29);
          intervals = eachDayOfInterval({ start, end });
          dateFormat = "dd MMM"; // Show date for monthly
          break;
        default:
          start = subDays(startOfDay(now), 6);
          intervals = eachDayOfInterval({ start, end });
          dateFormat = "EEE";
      }

      const { data, error } = await supabase
        .from("trips")
        .select("pickup_time, status")
        .eq("org_id", currentOrganization?.id)
        .gte("pickup_time", start.toISOString())
        .lte("pickup_time", end.toISOString());

      if (error) throw error;

      return intervals.map((interval) => {
        const intervalTrips = data.filter((trip) => {
          const tripDate = new Date(trip.pickup_time);
          if (timeRange === "daily") {
            return isSameHour(tripDate, interval);
          } else {
            return isSameDay(tripDate, interval);
          }
        });

        const completed = intervalTrips.filter(
          (t) => t.status === "completed"
        ).length;

        const assigned = intervalTrips.filter((t) =>
          ["assigned", "accepted", "arrived", "in_progress"].includes(t.status)
        ).length;

        const pending = intervalTrips.filter(
          (t) => t.status === "pending"
        ).length;

        const cancelled = intervalTrips.filter(
          (t) => t.status === "cancelled"
        ).length;

        const noShow = intervalTrips.filter(
          (t) => t.status === "no_show"
        ).length;

        // "Today's trips" logic is implicitly covered by the total of these for the day/hour

        return {
          name: format(interval, dateFormat),
          completed,
          assigned,
          pending,
          cancelled,
          noShow,
          total: completed + assigned + pending + cancelled + noShow,
        };
      });
    },
    enabled: !!currentOrganization,
  });

  const hasData = chartData?.some((d) => d.total > 0);

  // Custom Legend to match "trips badges" style logic
  const renderLegend = (props: any) => {
    const { payload } = props;
    return (
      <div className="flex flex-wrap justify-center gap-4 mt-8">
        {payload.map((entry: any, index: number) => (
          <div key={`item-${index}`} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-xs font-semibold text-slate-600 capitalize">
              {entry.value === "noShow" ? "No Show" : entry.value}
            </span>
          </div>
        ))}
      </div>
    );
  };

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
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 10, right: 0, left: -20, bottom: 20 }}
            >
              <defs>
                <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#059669" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#059669" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorAssigned" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorPending" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#64748b" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#64748b" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorCancelled" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#dc2626" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#dc2626" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorNoShow" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#d97706" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#d97706" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#f1f5f9"
              />
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#94a3b8", fontSize: 11, fontWeight: 600 }}
                dy={16}
                interval={
                  timeRange === "monthly"
                    ? 4
                    : timeRange === "biweekly"
                    ? 2
                    : "preserveStartEnd"
                }
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#94a3b8", fontSize: 11, fontWeight: 600 }}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: "12px",
                  border: "1px solid #f1f5f9",
                  boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                  padding: "12px",
                  backgroundColor: "#fff",
                }}
                itemStyle={{ fontSize: "12px", fontWeight: 600 }}
                labelStyle={{
                  color: "#64748b",
                  marginBottom: "8px",
                  fontSize: "11px",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              />
              <Legend content={renderLegend} />
              <Area
                type="monotone"
                dataKey="completed"
                name="Completed"
                stackId="1"
                stroke="#059669"
                fill="url(#colorCompleted)"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="assigned"
                name="Assigned"
                stackId="1"
                stroke="#2563eb"
                fill="url(#colorAssigned)"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="pending"
                name="Pending"
                stackId="1"
                stroke="#64748b"
                fill="url(#colorPending)"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="cancelled"
                name="Cancelled"
                stackId="1"
                stroke="#dc2626"
                fill="url(#colorCancelled)"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="noShow"
                name="No Show"
                stackId="1"
                stroke="#d97706"
                fill="url(#colorNoShow)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
