import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  CircleNotch,
  TrendUp,
  ChartLineUp,
  ArrowUpRight,
} from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useOrganization } from "@/contexts/OrganizationContext";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { useOnboarding } from "@/contexts/OnboardingContext";

export function PerformanceChart() {
  const { currentOrganization } = useOrganization();
  const { navigateTo } = useOnboarding();

  const { data: chartData, isLoading } = useQuery({
    queryKey: ["performance-chart", currentOrganization?.id],
    queryFn: async () => {
      const days = Array.from({ length: 7 }, (_, i) =>
        subDays(new Date(), 6 - i)
      );

      const { data, error } = await supabase
        .from("trips")
        .select("pickup_time")
        .eq("org_id", currentOrganization?.id)
        .gte("pickup_time", startOfDay(days[0]).toISOString())
        .lte("pickup_time", endOfDay(days[6]).toISOString());

      if (error) throw error;

      return days.map((day) => {
        const dayStr = format(day, "EEE");
        const count = data.filter(
          (trip) =>
            format(new Date(trip.pickup_time), "yyyy-MM-dd") ===
            format(day, "yyyy-MM-dd")
        ).length;

        return {
          name: dayStr,
          trips: count,
          revenue: count * 45, // Placeholder logic for revenue
        };
      });
    },
    enabled: !!currentOrganization,
  });

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm col-span-1 lg:col-span-3 h-[450px] flex items-center justify-center">
        <CircleNotch size={32} className="animate-spin text-slate-300" />
      </div>
    );
  }

  const totalTrips = chartData?.reduce((acc, curr) => acc + curr.trips, 0) || 0;

  return (
    <div
      onClick={() => navigateTo("trips")}
      className="bg-white rounded-2xl p-8 border border-slate-100 shadow-sm transition-all hover:shadow-md hover:border-lime-200 cursor-pointer lg:col-span-3 group"
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
            Operational trip volume velocity
          </p>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em] mb-1">
              Active Trips
            </p>
            <div className="flex items-center gap-2">
              <span className="text-3xl font-bold text-slate-900 tabular-nums">
                {totalTrips}
              </span>
              <span className="flex items-center text-xs font-bold text-lime-600 bg-lime-50 px-2 py-1 rounded-lg">
                <TrendUp size={12} weight="bold" />
                12%
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="h-[280px] w-full mt-4">
        {totalTrips === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
              <ChartLineUp size={32} className="text-slate-300" />
            </div>
            <p className="text-slate-500 font-medium">
              Awaiting operational data.
            </p>
            <p className="text-sm text-slate-400">
              Begin scheduling trips to see velocity trends.
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorTrips" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#84cc16" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#84cc16" stopOpacity={0} />
                </linearGradient>
                <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                  {/* <feGaussianBlur stdDeviation="3" result="blur" /> */}
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
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
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#94a3b8", fontSize: 11, fontWeight: 600 }}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: "16px",
                  border: "1px solid #f1f5f9",
                  boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.05)",
                  padding: "12px",
                  backgroundColor: "#fff",
                }}
                itemStyle={{ color: "#1e293b", fontWeight: 700 }}
              />
              <Area
                type="monotone"
                dataKey="trips"
                stroke="#84cc16"
                strokeWidth={4}
                fillOpacity={1}
                fill="url(#colorTrips)"
                animationDuration={2000}
                filter="url(#glow)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
