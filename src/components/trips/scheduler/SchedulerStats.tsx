import { memo } from "react";
import { Calendar as CalendarIcon, Clock, Users, MapPin } from "lucide-react";

interface SchedulerStatsProps {
  todayCount: number;
  activeCount: number;
  pendingCount: number;
  totalCount: number;
}

export const SchedulerStats = memo(function SchedulerStats({
  todayCount,
  activeCount,
  pendingCount,
  totalCount,
}: SchedulerStatsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <StatCard
        icon={<CalendarIcon className="w-5 h-5 text-blue-600" />}
        iconBg="bg-blue-50"
        value={todayCount}
        label="Today's Trips"
      />
      <StatCard
        icon={<Clock className="w-5 h-5 text-emerald-600" />}
        iconBg="bg-emerald-50"
        value={activeCount}
        label="Active Now"
      />
      <StatCard
        icon={<Users className="w-5 h-5 text-amber-600" />}
        iconBg="bg-amber-50"
        value={pendingCount}
        label="Pending"
      />
      <StatCard
        icon={<MapPin className="w-5 h-5 text-slate-600" />}
        iconBg="bg-slate-50"
        value={totalCount}
        label="Total Trips"
      />
    </div>
  );
});

function StatCard({ icon, iconBg, value, label }: { icon: React.ReactNode; iconBg: string; value: number; label: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg ${iconBg} flex items-center justify-center`}>
          {icon}
        </div>
        <div>
          <p className="text-2xl font-bold text-slate-900">{value}</p>
          <p className="text-xs text-slate-500">{label}</p>
        </div>
      </div>
    </div>
  );
}
