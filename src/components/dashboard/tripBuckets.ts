import { addDays, format, parseISO } from "date-fns";
import { fromZonedTime } from "date-fns-tz";

export type TimeRange = "daily" | "weekly" | "biweekly" | "monthly";

export interface TripBucket {
  bucket: string;
  total: number;
  completed: number;
  assigned: number;
  pending: number;
  cancelled: number;
  no_show: number;
}

export interface DashboardChartPoint {
  name: string;
  total: number;
  completed: number;
  assigned: number;
  pending: number;
  cancelled: number;
  noShow: number;
}

export function getPerformanceRange(today: string, timeRange: TimeRange, timezone: string) {
  const count = { daily: 1, weekly: 7, biweekly: 14, monthly: 30 }[timeRange];
  const lastDay = parseISO(today);
  const firstDay = addDays(lastDay, 1 - count);
  const days = Array.from({ length: count }, (_, index) => format(addDays(firstDay, index), "yyyy-MM-dd"));
  return {
    days,
    start: fromZonedTime(`${days[0]}T00:00:00`, timezone).toISOString(),
    end: fromZonedTime(`${format(addDays(lastDay, 1), "yyyy-MM-dd")}T00:00:00`, timezone).toISOString(),
  };
}

export function buildChartPoints(days: string[], timeRange: TimeRange, buckets: TripBucket[]): DashboardChartPoint[] {
  const byBucket = new Map(buckets.map((bucket) => [bucket.bucket, bucket]));
  const keys = timeRange === "daily"
    ? Array.from({ length: 24 }, (_, hour) => `${days[0]} ${String(hour).padStart(2, "0")}:00`)
    : days;

  return keys.map((key) => {
    const bucket = byBucket.get(key);
    return {
      name: timeRange === "daily" ? key.slice(11) : format(parseISO(key), timeRange === "weekly" ? "EEE" : "dd MMM"),
      total: Number(bucket?.total ?? 0),
      completed: Number(bucket?.completed ?? 0),
      assigned: Number(bucket?.assigned ?? 0),
      pending: Number(bucket?.pending ?? 0),
      cancelled: Number(bucket?.cancelled ?? 0),
      noShow: Number(bucket?.no_show ?? 0),
    };
  });
}
