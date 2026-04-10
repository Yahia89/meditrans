import { useState, useMemo, useCallback } from "react";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useAuth } from "@/contexts/auth-context";
import { useTimezone } from "@/hooks/useTimezone";
import { toZonedTime, fromZonedTime } from "date-fns-tz";
import { formatInUserTimezone, getTimezoneLabel } from "@/lib/timezone";
import { toast } from "sonner";
import type { Trip, TripStatus } from "../types";
import type { ViewMode, QuickAddData } from "./types";

// --- Utility functions (moved inside or kept outside) ---

function getWeekDates(date: Date, timezone: string): Date[] {
  const zonedDate = toZonedTime(date, timezone);
  const dates: Date[] = [];
  const dayOfWeek = zonedDate.getDay();
  const start = new Date(zonedDate);
  start.setDate(zonedDate.getDate() - dayOfWeek);
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    dates.push(fromZonedTime(d, timezone));
  }
  return dates;
}

function getMonthDates(date: Date, timezone: string): Date[] {
  const zonedDate = toZonedTime(date, timezone);
  const year = zonedDate.getFullYear();
  const month = zonedDate.getMonth();
  const firstDayZoned = new Date(year, month, 1);
  const startDay = firstDayZoned.getDay();
  const dates: Date[] = [];
  const curr = new Date(firstDayZoned);
  curr.setDate(curr.getDate() - startDay);
  for (let i = 0; i < 42; i++) {
    const d = new Date(curr);
    dates.push(fromZonedTime(d, timezone));
    curr.setDate(curr.getDate() + 1);
  }
  return dates;
}

function getQueryDateRange(date: Date): { start: string; end: string } {
  const start = new Date(date);
  start.setMonth(start.getMonth() - 1);
  start.setDate(1);
  start.setHours(0, 0, 0, 0);

  const end = new Date(date);
  end.setMonth(end.getMonth() + 2);
  end.setDate(0); 
  end.setHours(23, 59, 59, 999);

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

const TRIPS_SELECT = `
  id,
  org_id,
  patient_id,
  driver_id,
  pickup_location,
  dropoff_location,
  pickup_time,
  trip_type,
  status,
  notes,
  created_at,
  patient:patients(id, full_name, phone, created_at),
  driver:drivers(id, full_name, phone, user_id, vehicle_info)
`;

export function useTripsScheduler({
  patientId,
  driverId,
}: {
  patientId?: string;
  driverId?: string;
}) {
  const { currentOrganization } = useOrganization();
  const { profile, refresh } = useAuth();
  const activeTimezone = useTimezone();
  const queryClient = useQueryClient();

  // View state
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<TripStatus | "all">("all");
  const [isMonthExpanded, setIsMonthExpanded] = useState(false);
  const [quickAddData, setQuickAddData] = useState<QuickAddData | null>(null);
  const [isUpdatingTimezone, setIsUpdatingTimezone] = useState(false);

  // Derive query date range
  const queryDateRange = useMemo(
    () => getQueryDateRange(selectedDate),
    [selectedDate.getFullYear(), selectedDate.getMonth()]
  );

  // Fetch trips
  const {
    data: trips,
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: [
      "trips",
      currentOrganization?.id,
      patientId,
      driverId,
      queryDateRange.start,
      queryDateRange.end,
    ],
    queryFn: async () => {
      let query = supabase
        .from("trips")
        .select(TRIPS_SELECT)
        .eq("org_id", currentOrganization?.id)
        .gte("pickup_time", queryDateRange.start)
        .lte("pickup_time", queryDateRange.end)
        .order("pickup_time", { ascending: true });

      if (patientId) query = query.eq("patient_id", patientId);
      if (driverId) query = query.eq("driver_id", driverId);

      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as Trip[];
    },
    enabled: !!currentOrganization,
    refetchInterval: 30000,
    staleTime: 10000,
    placeholderData: keepPreviousData,
  });

  // Prefetching logic to prevent loading flashes on month change
  const prefetchAdjacentMonths = useCallback((baseDate: Date) => {
    if (!currentOrganization) return;
    
    [ -1, 1 ].forEach((offset) => {
      const targetDate = new Date(baseDate);
      targetDate.setMonth(targetDate.getMonth() + offset);
      const range = getQueryDateRange(targetDate);
      
      queryClient.prefetchQuery({
        queryKey: [
          "trips",
          currentOrganization.id,
          patientId,
          driverId,
          range.start,
          range.end,
        ],
        queryFn: async () => {
          let query = supabase
            .from("trips")
            .select(TRIPS_SELECT)
            .eq("org_id", currentOrganization.id)
            .gte("pickup_time", range.start)
            .lte("pickup_time", range.end)
            .order("pickup_time", { ascending: true });
            
          if (patientId) query = query.eq("patient_id", patientId);
          if (driverId) query = query.eq("driver_id", driverId);
          
          const { data, error } = await query;
          if (error) throw error;
          return data as unknown as Trip[];
        },
        staleTime: 60000,
      });
    });
  }, [currentOrganization, patientId, driverId, queryClient]);

  const handleUpdateTimezone = useCallback(
    async (newTimezone: string) => {
      if (!profile) return;
      setIsUpdatingTimezone(true);
      try {
        const { error } = await supabase
          .from("user_profiles")
          .update({ timezone: newTimezone || null })
          .eq("user_id", profile.user_id);

        if (error) throw error;
        await refresh();
        const timezoneLabel = newTimezone
          ? getTimezoneLabel(newTimezone)
          : "Organization Default";
        toast.success(`Timezone updated to ${timezoneLabel}`);
      } catch (error: any) {
        console.error("Error updating timezone:", error);
        toast.error(error.message || "Failed to update timezone");
      } finally {
        setIsUpdatingTimezone(false);
      }
    },
    [profile, refresh]
  );

  const calendarDates = useMemo(() => {
    return isMonthExpanded
      ? getMonthDates(selectedDate, activeTimezone)
      : getWeekDates(selectedDate, activeTimezone);
  }, [selectedDate, isMonthExpanded, activeTimezone]);

  const filteredTrips = useMemo(() => {
    if (!trips) return [];
    return trips.filter((trip) => {
      if (statusFilter !== "all" && trip.status !== statusFilter) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesPatient = trip.patient?.full_name?.toLowerCase().includes(query);
        const matchesDriver = trip.driver?.full_name?.toLowerCase().includes(query);
        const matchesLocation =
          trip.pickup_location?.toLowerCase().includes(query) ||
          trip.dropoff_location?.toLowerCase().includes(query);
        const matchesType = trip.trip_type?.toLowerCase().includes(query);
        if (!matchesPatient && !matchesDriver && !matchesLocation && !matchesType)
          return false;
      }
      return true;
    });
  }, [trips, statusFilter, searchQuery]);

  const todayStr = useMemo(
    () => formatInUserTimezone(new Date(), activeTimezone, "yyyy-MM-dd"),
    [activeTimezone]
  );

  const selectedDateStr = useMemo(
    () => formatInUserTimezone(selectedDate, activeTimezone, "yyyy-MM-dd"),
    [selectedDate, activeTimezone]
  );

  const tripsForDate = useMemo(() => {
    return filteredTrips.filter((trip) => {
      const tripDateStr = formatInUserTimezone(trip.pickup_time, activeTimezone, "yyyy-MM-dd");
      return tripDateStr === selectedDateStr;
    });
  }, [filteredTrips, selectedDateStr, activeTimezone]);

  const tripCountByDay = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredTrips.forEach((trip) => {
      const dateKey = formatInUserTimezone(trip.pickup_time, activeTimezone, "yyyy-MM-dd");
      counts[dateKey] = (counts[dateKey] || 0) + 1;
    });
    return counts;
  }, [filteredTrips, activeTimezone]);

  const stats = useMemo(() => ({
    activeCount: filteredTrips.filter((t) => t.status === "in_progress").length,
    pendingCount: filteredTrips.filter((t) => t.status === "pending").length,
    todayCount: tripsForDate.length,
    totalCount: filteredTrips.length,
  }), [filteredTrips, tripsForDate]);

  const goToPrevious = useCallback(() => {
    setSelectedDate((prev) => {
      const newDate = new Date(prev);
      if (isMonthExpanded) {
        newDate.setMonth(newDate.getMonth() - 1);
      } else {
        newDate.setDate(newDate.getDate() - 7);
      }
      prefetchAdjacentMonths(newDate);
      return newDate;
    });
  }, [isMonthExpanded, prefetchAdjacentMonths]);

  const goToNext = useCallback(() => {
    setSelectedDate((prev) => {
      const newDate = new Date(prev);
      if (isMonthExpanded) {
        newDate.setMonth(newDate.getMonth() + 1);
      } else {
        newDate.setDate(newDate.getDate() + 7);
      }
      prefetchAdjacentMonths(newDate);
      return newDate;
    });
  }, [isMonthExpanded, prefetchAdjacentMonths]);

  const goToToday = useCallback(() => setSelectedDate(new Date()), []);

  const handleQuickAdd = useCallback(
    (pId: string, pName: string, date: Date) =>
      setQuickAddData({ patientId: pId, patientName: pName, date }),
    []
  );

  return {
    state: {
      viewMode,
      selectedDate,
      selectedDateStr,
      todayStr,
      searchQuery,
      statusFilter,
      isMonthExpanded,
      quickAddData,
      isUpdatingTimezone,
      isLoading,
      isFetching,
      activeTimezone,
      profile,
    },
    actions: {
      setViewMode,
      setSelectedDate,
      setSearchQuery,
      setStatusFilter,
      setIsMonthExpanded,
      setQuickAddData,
      refetch,
      handleUpdateTimezone,
      goToPrevious,
      goToNext,
      goToToday,
      handleQuickAdd,
    },
    data: {
      trips,
      filteredTrips,
      tripsForDate,
      calendarDates,
      tripCountByDay,
      stats,
    },
  };
}
