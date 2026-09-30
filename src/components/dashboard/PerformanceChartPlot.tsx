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
import type { DashboardChartPoint, TimeRange } from "./tripBuckets";

export default function PerformanceChartPlot({ chartData, timeRange }: { chartData: DashboardChartPoint[]; timeRange: TimeRange }) {
  // Custom Legend to match "trips badges" style logic
  const renderLegend = (props: { payload?: readonly { color?: string; value?: string }[] }) => {
    const { payload = [] } = props;
    return (
      <div className="flex flex-wrap justify-center gap-4 mt-8">
        {payload.map((entry, index) => (
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
  );
}
