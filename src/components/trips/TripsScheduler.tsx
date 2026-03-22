import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useAuth } from "@/contexts/auth-context";
import { usePermissions } from "@/hooks/usePermissions";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { Button } from "@/components/ui/button";
import {
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Search,
  Clock,
  Users,
  MapPin,
  Calendar as CalendarIcon,
  LayoutGrid,
  List,
  Loader2,
} from "lucide-react";
import { Plus, CloudArrowUp, ArrowClockwise } from "@phosphor-icons/react";
import type { Trip, TripStatus } from "./types";
import { cn } from "@/lib/utils";
import { formatInUserTimezone, getTimezoneLabel } from "@/lib/timezone";
import { TripTimeline, TripTimelineVertical } from "./TripTimeline";
import { TripCardsView } from "./TripCardsView";
import { TripListView } from "./TripListView";
import { Input } from "@/components/ui/input";
import { QuickAddLegDialog } from "./QuickAddLegDialog";
import { useTimezone } from "@/hooks/useTimezone";
import { TimezoneSelector } from "../timezone-selector";
import { toZonedTime, fromZonedTime } from "date-fns-tz";
import { toast } from "sonner";

// --- Constants (moved outside component) ---

const STATUS_COLORS: Record<TripStatus, string> = {
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

// Only select the columns we need from trips (not *)
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

// --- Props ---

interface TripsSchedulerProps {
  onCreateClick?: () => void;
  onDischargeClick?: () => void;
  onBulkImportClick?: () => void;
  onTripClick: (id: string) => void;
  patientId?: string;
  driverId?: string;
}

// --- Utility functions ---

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

/**
 * Get a date range for the Supabase query.
 * Fetches 3 months of data centered on the selected date to allow
 * smooth navigation without refetching every time.
 */
function getQueryDateRange(date: Date): { start: string; end: string } {
  const start = new Date(date);
  start.setMonth(start.getMonth() - 1);
  start.setDate(1);
  start.setHours(0, 0, 0, 0);

  const end = new Date(date);
  end.setMonth(end.getMonth() + 2);
  end.setDate(0); // last day of next month
  end.setHours(23, 59, 59, 999);

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

// --- Main Component ---

export function TripsScheduler({
  onCreateClick,
  onDischargeClick,
  onBulkImportClick,
  onTripClick,
  patientId,
  driverId,
}: TripsSchedulerProps) {
  const { currentOrganization } = useOrganization();
  const { profile, refresh } = useAuth();
  const { isDriver } = usePermissions();
  const activeTimezone = useTimezone();
  const isMobile = useMediaQuery("(max-width: 767px)");
  const [isUpdatingTimezone, setIsUpdatingTimezone] = useState(false);

  // View state
  const [viewMode, setViewMode] = useState<"timeline" | "list" | "cards">(
    "cards",
  );
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<TripStatus | "all">("all");
  const [isMonthExpanded, setIsMonthExpanded] = useState(false);
  const [quickAddData, setQuickAddData] = useState<{
    patientId: string;
    patientName: string;
    date: Date;
  } | null>(null);

  // Derive query date range from selectedDate (no useEffect!)
  const queryDateRange = useMemo(
    () => getQueryDateRange(selectedDate),
    // Only re-derive when month changes, not every date selection
    [selectedDate.getFullYear(), selectedDate.getMonth()],
  );

  // Fetch trips with date range filter
  const {
    data: trips,
    isLoading,
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

      if (patientId) {
        query = query.eq("patient_id", patientId);
      }
      if (driverId) {
        query = query.eq("driver_id", driverId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as Trip[];
    },
    enabled: !!currentOrganization,
    refetchInterval: 30000,
    staleTime: 10000, // Don't refetch if data is less than 10s old
  });

  // Memoized timezone update handler
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
    [profile, refresh],
  );

  // Calendar dates (week/month grid)
  const calendarDates = useMemo(() => {
    return isMonthExpanded
      ? getMonthDates(selectedDate, activeTimezone)
      : getWeekDates(selectedDate, activeTimezone);
  }, [selectedDate, isMonthExpanded, activeTimezone]);

  // Filter trips for display
  const filteredTrips = useMemo(() => {
    if (!trips) return [];
    return trips.filter((trip) => {
      if (statusFilter !== "all" && trip.status !== statusFilter) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesPatient = trip.patient?.full_name
          ?.toLowerCase()
          .includes(query);
        const matchesDriver = trip.driver?.full_name
          ?.toLowerCase()
          .includes(query);
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

  // Pre-compute today's date string once
  const todayStr = useMemo(
    () => formatInUserTimezone(new Date(), activeTimezone, "yyyy-MM-dd"),
    [activeTimezone],
  );

  const selectedDateStr = useMemo(
    () => formatInUserTimezone(selectedDate, activeTimezone, "yyyy-MM-dd"),
    [selectedDate, activeTimezone],
  );

  // Trips for selected date
  const tripsForDate = useMemo(() => {
    return filteredTrips.filter((trip) => {
      const tripDateStr = formatInUserTimezone(
        trip.pickup_time,
        activeTimezone,
        "yyyy-MM-dd",
      );
      return tripDateStr === selectedDateStr;
    });
  }, [filteredTrips, selectedDateStr, activeTimezone]);

  // Count trips per day (for calendar badges)
  const tripCountByDay = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredTrips.forEach((trip) => {
      const dateKey = formatInUserTimezone(
        trip.pickup_time,
        activeTimezone,
        "yyyy-MM-dd",
      );
      counts[dateKey] = (counts[dateKey] || 0) + 1;
    });
    return counts;
  }, [filteredTrips, activeTimezone]);

  // Active & pending counts (derived, not synced with useEffect)
  const activeCount = useMemo(
    () => filteredTrips.filter((t) => t.status === "in_progress").length,
    [filteredTrips],
  );
  const pendingCount = useMemo(
    () => filteredTrips.filter((t) => t.status === "pending").length,
    [filteredTrips],
  );

  // Navigation handlers (stable references via useCallback)
  const goToPrevious = useCallback(() => {
    setSelectedDate((prev) => {
      const newDate = new Date(prev);
      if (isMonthExpanded) {
        newDate.setMonth(newDate.getMonth() - 1);
      } else {
        newDate.setDate(newDate.getDate() - 7);
      }
      return newDate;
    });
  }, [isMonthExpanded]);

  const goToNext = useCallback(() => {
    setSelectedDate((prev) => {
      const newDate = new Date(prev);
      if (isMonthExpanded) {
        newDate.setMonth(newDate.getMonth() + 1);
      } else {
        newDate.setDate(newDate.getDate() + 7);
      }
      return newDate;
    });
  }, [isMonthExpanded]);

  const goToToday = useCallback(() => setSelectedDate(new Date()), []);

  const handleQuickAdd = useCallback(
    (pId: string, pName: string, date: Date) =>
      setQuickAddData({ patientId: pId, patientName: pName, date }),
    [],
  );

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          {isDriver ? (
            <>
              <h1 className="text-2xl font-bold text-slate-900">
                Hello, {profile?.full_name?.split(" ")[0] || "Driver"}
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                View and manage your assigned trips
              </p>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-slate-900">
                Trip Scheduler
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                Manage and track all patient transportation
              </p>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="h-10 px-4 gap-2 border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl font-medium"
          >
            <ArrowClockwise className="w-4 h-4" />
            <span className="hidden sm:inline">Refresh</span>
          </Button>

          {onBulkImportClick && (
            <Button
              onClick={onBulkImportClick}
              variant="outline"
              className="border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 shadow-sm rounded-xl h-10 px-5 gap-2 font-semibold"
            >
              <CloudArrowUp className="w-4 h-4" weight="bold" />
              <span className="hidden sm:inline">Bulk Import</span>
            </Button>
          )}

          {onDischargeClick && (
            <Button
              onClick={onDischargeClick}
              className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm rounded-xl h-10 px-5 gap-2 font-semibold"
            >
              <Plus className="w-4 h-4" weight="bold" />
              Discharge Trip
            </Button>
          )}

          {onCreateClick && (
            <Button
              onClick={onCreateClick}
              className="bg-[#3D5A3D] hover:bg-[#2E4A2E] text-white shadow-sm rounded-xl h-10 px-5 gap-2 font-semibold"
            >
              <Plus className="w-4 h-4" weight="bold" />
              New Trip
            </Button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
              <CalendarIcon className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">
                {tripsForDate.length}
              </p>
              <p className="text-xs text-slate-500">Today's Trips</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
              <Clock className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">
                {activeCount}
              </p>
              <p className="text-xs text-slate-500">Active Now</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
              <Users className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">
                {pendingCount}
              </p>
              <p className="text-xs text-slate-500">Pending</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-slate-50 flex items-center justify-center">
              <MapPin className="w-5 h-5 text-slate-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">
                {trips?.length || 0}
              </p>
              <p className="text-xs text-slate-500">Total Trips</p>
            </div>
          </div>
        </div>
      </div>

      {/* Week Navigation & Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 transition-all duration-300 ease-in-out relative">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Week navigation */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={goToPrevious}
              className="h-8 w-8 p-0"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={goToToday}
              className="h-8 px-3 text-xs font-medium"
            >
              {isMonthExpanded
                ? formatInUserTimezone(
                    selectedDate,
                    activeTimezone,
                    "MMMM yyyy",
                  )
                : "Today"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={goToNext}
              className="h-8 w-8 p-0"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          {/* View toggle & Timezone */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center bg-slate-100 rounded-lg p-1 mr-2 relative">
              <TimezoneSelector
                value={profile?.timezone || ""}
                onValueChange={handleUpdateTimezone}
                className="h-8 border-none bg-transparent shadow-none hover:bg-white/50 min-w-[200px]"
              />
              {isUpdatingTimezone && (
                <div className="absolute right-2 top-1/2 -translate-y-1/2">
                  <Loader2 className="w-3 h-3 animate-spin text-slate-400" />
                </div>
              )}
            </div>

            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search trips..."
                className="pl-9 h-9"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as TripStatus | "all")
              }
              className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="assigned">Assigned</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <div className="hidden md:flex items-center border border-slate-200 rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode("timeline")}
                className={cn(
                  "h-9 px-3 text-sm flex items-center gap-1.5 transition-colors",
                  viewMode === "timeline"
                    ? "bg-slate-100 text-slate-900"
                    : "text-slate-500 hover:bg-slate-50",
                )}
              >
                <CalendarIcon className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("cards")}
                className={cn(
                  "h-9 px-3 text-sm flex items-center gap-1.5 transition-colors",
                  viewMode === "cards"
                    ? "bg-slate-100 text-slate-900"
                    : "text-slate-500 hover:bg-slate-50",
                )}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={cn(
                  "h-9 px-3 text-sm flex items-center gap-1.5 transition-colors",
                  viewMode === "list"
                    ? "bg-slate-100 text-slate-900"
                    : "text-slate-500 hover:bg-slate-50",
                )}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Calendar Grid (Week or Month) */}
        <div
          className={cn(
            "grid grid-cols-7 gap-2 mt-4 transition-all duration-300",
            isMonthExpanded ? "mb-6" : "mb-2",
          )}
        >
          {calendarDates.map((date) => {
            const dateStr = formatInUserTimezone(
              date,
              activeTimezone,
              "yyyy-MM-dd",
            );
            const isSelected = dateStr === selectedDateStr;
            const isToday = dateStr === todayStr;

            const zonedDate = toZonedTime(date, activeTimezone);
            const zonedSelected = toZonedTime(selectedDate, activeTimezone);
            const isCurrentMonth =
              zonedDate.getMonth() === zonedSelected.getMonth() &&
              zonedDate.getFullYear() === zonedSelected.getFullYear();

            const tripCount = tripCountByDay[dateStr] || 0;

            return (
              <button
                key={date.toISOString()}
                onClick={() => setSelectedDate(date)}
                className={cn(
                  "relative flex flex-col items-center py-3 px-2 rounded-xl transition-all border",
                  isSelected
                    ? "bg-[#3D5A3D] text-white shadow-lg border-[#3D5A3D] z-10 scale-105"
                    : isToday
                      ? "bg-slate-100 text-slate-900 border-slate-200"
                      : "bg-white hover:bg-slate-50 text-slate-600 border-transparent",
                  !isCurrentMonth && isMonthExpanded && "opacity-40 grayscale",
                )}
              >
                <span className="text-[10px] font-semibold uppercase tracking-wide opacity-70">
                  {formatInUserTimezone(date, activeTimezone, "EEE")}
                </span>
                <span className="text-lg font-bold mt-0.5">
                  {toZonedTime(date, activeTimezone).getDate()}
                </span>
                {tripCount > 0 && (
                  <span
                    className={cn(
                      "mt-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                      isSelected
                        ? "bg-white/20 text-white"
                        : "bg-slate-200 text-slate-600",
                    )}
                  >
                    {tripCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Shy Toggle - Bottom Center */}
        <div className="absolute bottom-0 left-0 right-0 flex justify-center translate-y-1/2 z-20">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsMonthExpanded(!isMonthExpanded)}
            className="rounded-full w-8 h-8 p-0 bg-white shadow-sm border-slate-200 hover:bg-slate-50 transition-transform hover:scale-110"
          >
            {isMonthExpanded ? (
              <ChevronUp className="w-4 h-4 text-slate-500" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-500" />
            )}
            <span className="sr-only">Toggle Month View</span>
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 min-h-[400px]">
        {isMobile ? (
          <TripTimelineVertical
            trips={filteredTrips}
            onTripClick={onTripClick}
            selectedDate={selectedDate}
            timezone={activeTimezone}
            onQuickAdd={handleQuickAdd}
          />
        ) : viewMode === "timeline" ? (
          <TripTimeline
            trips={filteredTrips}
            onTripClick={onTripClick}
            selectedDate={selectedDate}
            timezone={activeTimezone}
          />
        ) : viewMode === "cards" ? (
          <TripCardsView
            trips={tripsForDate}
            onTripClick={onTripClick}
            statusColors={STATUS_COLORS}
            timezone={activeTimezone}
            onQuickAdd={handleQuickAdd}
          />
        ) : (
          <TripListView
            trips={tripsForDate}
            onTripClick={onTripClick}
            statusColors={STATUS_COLORS}
            timezone={activeTimezone}
          />
        )}
      </div>

      {quickAddData && (
        <QuickAddLegDialog
          open={!!quickAddData}
          onOpenChange={(open) => !open && setQuickAddData(null)}
          patientId={quickAddData.patientId}
          patientName={quickAddData.patientName}
          date={quickAddData.date}
          onSuccess={() => refetch()}
        />
      )}
    </div>
  );
}
