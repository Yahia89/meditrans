import {
  MapPin,
  ArrowRight,
  CircleNotch,
  ListChecks,
  ArrowUpRight,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useOrganization } from "@/contexts/OrganizationContext";
import { formatDistanceToNow } from "date-fns";
import { useQueryState } from "nuqs";

export function RecentActivity() {
  const { currentOrganization } = useOrganization();
  const [_, setPage] = useQueryState("page");
  const [__, setTripId] = useQueryState("tripId");
  const [___, setFromPage] = useQueryState("from");
  const [____, setSection] = useQueryState("section");

  const { data: activities, isLoading } = useQuery({
    queryKey: ["recent-activity", currentOrganization?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trips")
        .select(
          `
          id,
          status,
          updated_at,
          pickup_location,
          dropoff_location,
          patient:patients(full_name),
          driver:drivers(full_name)
        `
        )
        .eq("org_id", currentOrganization?.id)
        .order("updated_at", { ascending: false })
        .limit(5);

      if (error) throw error;
      return data;
    },
    enabled: !!currentOrganization,
  });

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm col-span-1 lg:col-span-2 flex items-center justify-center h-[400px]">
        <CircleNotch size={32} className="animate-spin text-slate-300" />
      </div>
    );
  }

  const hasActivities = activities && activities.length > 0;

  const handleActivityClick = (id: string) => {
    setTripId(id);
    setFromPage("dashboard");
    setSection("activity");
    setPage("trip-details");
  };

  return (
    <div className="bg-white rounded-2xl p-8 border border-slate-100 shadow-sm lg:col-span-2 group/card">
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-xl font-bold text-slate-900">
              Recent Activity
            </h2>
            <ArrowUpRight
              size={18}
              className="text-slate-400 opacity-0 group-hover/card:opacity-100 transition-opacity"
            />
          </div>
          <p className="text-sm text-slate-500">
            Live operational event stream
          </p>
        </div>
        {hasActivities && (
          <button
            onClick={() => setPage("trips")}
            className="text-xs font-bold text-lime-600 hover:text-lime-700 transition-colors uppercase tracking-widest px-3 py-1.5 bg-lime-50 rounded-lg"
          >
            View All
          </button>
        )}
      </div>

      <div className="space-y-4">
        {!hasActivities ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
              <ListChecks size={32} className="text-slate-300" />
            </div>
            <p className="text-slate-500 font-medium text-sm">
              No recent activity discovered.
            </p>
            <p className="text-xs text-slate-400 mt-1 max-w-[200px] leading-relaxed">
              Updates will appear here as the fleet operates.
            </p>
          </div>
        ) : (
          activities.map((activity) => (
            <div
              key={activity.id}
              onClick={() => handleActivityClick(activity.id)}
              className="flex items-center gap-4 p-5 rounded-2xl hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-all cursor-pointer group"
            >
              <div className="relative">
                <div
                  className={cn(
                    "w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm",
                    activity.status === "in_progress"
                      ? "bg-orange-500"
                      : activity.status === "completed"
                      ? "bg-emerald-500"
                      : "bg-slate-400"
                  )}
                >
                  {((activity.patient as any)?.full_name || "U").charAt(0)}
                </div>
                <div
                  className={cn(
                    "absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-white shadow-sm",
                    activity.status === "in_progress"
                      ? "bg-orange-500"
                      : activity.status === "completed"
                      ? "bg-emerald-500"
                      : "bg-slate-400"
                  )}
                />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900 truncate">
                    {(activity.patient as any)?.full_name || "Unknown Patient"}
                  </span>
                  <ArrowRight
                    size={14}
                    weight="bold"
                    className="text-slate-300 group-hover:text-lime-500 transition-colors"
                  />
                  <span className="text-sm font-medium text-slate-500 truncate">
                    {(activity.driver as any)?.full_name || "Unassigned"}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-400">
                  <MapPin size={14} weight="fill" className="text-slate-300" />
                  <span className="truncate">
                    {activity.pickup_location} → {activity.dropoff_location}
                  </span>
                </div>
              </div>

              <div className="text-right flex flex-col items-end gap-1.5">
                <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">
                  {formatDistanceToNow(new Date(activity.updated_at), {
                    addSuffix: true,
                  })}
                </span>
                <span
                  className={cn(
                    "px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-tight border",
                    activity.status === "in_progress"
                      ? "bg-orange-50 text-orange-700 border-orange-100"
                      : activity.status === "completed"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                      : "bg-slate-50 text-slate-600 border-slate-200"
                  )}
                >
                  {activity.status.replace("_", " ")}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
