import type { TripStatus } from "../types";

export const STATUS_COLORS: Record<TripStatus, string> = {
  pending: "bg-slate-100 text-slate-700 border-slate-200",
  assigned: "bg-blue-50 text-blue-700 border-blue-100",
  accepted: "bg-indigo-50 text-indigo-700 border-indigo-100",
  en_route: "bg-purple-50 text-purple-700 border-purple-100",
  arrived: "bg-amber-50 text-amber-700 border-amber-100",
  in_progress: "bg-blue-100 text-blue-800 border-blue-200",
  waiting: "bg-amber-100 text-amber-800 border-amber-200",
  completed: "bg-emerald-50 text-emerald-700 border-emerald-100",
  cancelled: "bg-red-50 text-red-700 border-red-100",
  no_show: "bg-orange-50 text-orange-700 border-orange-100",
};
