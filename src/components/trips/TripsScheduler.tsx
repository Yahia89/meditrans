import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useAuth } from "@/contexts/auth-context";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import {
  Plus,
  Loader2,
  Calendar as CalendarIcon,
  List,
  LayoutGrid,
  ChevronLeft,
  ChevronRight,
  Search,
  Clock,
  Users,
  MapPin,
  Car,
  User,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { Trip, TripStatus } from "./types";
import { cn } from "@/lib/utils";
import { TripTimeline, TripTimelineVertical } from "./TripTimeline";
import { Input } from "@/components/ui/input";
import { QuickAddLegDialog } from "./QuickAddLegDialog";

interface TripsSchedulerProps {
  onCreateClick?: () => void;
  onTripClick: (id: string) => void;
  patientId?: string;
  driverId?: string;
}

const statusColors: Record<TripStatus, string> = {
  pending: "bg-slate-100 text-slate-700 border-slate-200",
  assigned: "bg-blue-50 text-blue-700 border-blue-100",
  accepted: "bg-indigo-50 text-indigo-700 border-indigo-100",
  en_route: "bg-purple-50 text-purple-700 border-purple-100",
  arrived: "bg-amber-50 text-amber-700 border-amber-100",
  in_progress: "bg-blue-100 text-blue-800 border-blue-200",
  completed: "bg-emerald-50 text-emerald-700 border-emerald-100",
  cancelled: "bg-red-50 text-red-700 border-red-100",
  no_show: "bg-orange-50 text-orange-700 border-orange-100",
};

// Generate dates for week view
function getWeekDates(date: Date): Date[] {
  const dates: Date[] = [];
  const start = new Date(date);
  start.setDate(start.getDate() - start.getDay()); // Start from Sunday

  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    dates.push(d);
  }
  return dates;
}

// Generate dates for month view (shy calendar)
function getMonthDates(date: Date): Date[] {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1);
  const startDay = firstDay.getDay(); // 0 = Sunday

  const dates: Date[] = [];
  const curr = new Date(firstDay);
  curr.setDate(curr.getDate() - startDay);

  // 42 days for 6 weeks grid to cover all months fully
  for (let i = 0; i < 42; i++) {
    dates.push(new Date(curr));
    curr.setDate(curr.getDate() + 1);
  }
  return dates;
}

export function TripsScheduler({
  onCreateClick,
  onTripClick,
  patientId,
  driverId,
}: TripsSchedulerProps) {
  const { currentOrganization } = useOrganization();
  const { profile } = useAuth();
  const { isDriver } = usePermissions();

  // View state
  const [viewMode, setViewMode] = useState<"timeline" | "list" | "cards">(
    "cards"
  );
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<TripStatus | "all">("all");
  const [isMobile, setIsMobile] = useState(false);
  const [isMonthExpanded, setIsMonthExpanded] = useState(false);
  const [quickAddData, setQuickAddData] = useState<{
    patientId: string;
    patientName: string;
    date: Date;
  } | null>(null);

  // Detect mobile
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Fetch trips
  const {
    data: trips,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["trips", currentOrganization?.id, patientId, driverId],
    queryFn: async () => {
      let query = supabase
        .from("trips")
        .select(
          `
          *,
          patient:patients(id, full_name, phone, created_at),
          driver:drivers(id, full_name, phone, user_id, vehicle_info)
        `
        )
        .eq("org_id", currentOrganization?.id)
        .order("pickup_time", { ascending: true });

      if (patientId) {
        query = query.eq("patient_id", patientId);
      }
      if (driverId) {
        query = query.eq("driver_id", driverId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Trip[];
    },
    enabled: !!currentOrganization,
    refetchInterval: 30000, // Auto refresh every 30 seconds
  });

  // Dates for navigation (Week or Month)
  const calendarDates = useMemo(() => {
    return isMonthExpanded
      ? getMonthDates(selectedDate)
      : getWeekDates(selectedDate);
  }, [selectedDate, isMonthExpanded]);

  // Filter trips
  const filteredTrips = useMemo(() => {
    if (!trips) return [];

    return trips.filter((trip) => {
      // Status filter
      if (statusFilter !== "all" && trip.status !== statusFilter) {
        return false;
      }

      // Search filter
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

        if (
          !matchesPatient &&
          !matchesDriver &&
          !matchesLocation &&
          !matchesType
        ) {
          return false;
        }
      }

      return true;
    });
  }, [trips, statusFilter, searchQuery]);

  // Trips for selected date
  const tripsForDate = useMemo(() => {
    const startOfDay = new Date(selectedDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(selectedDate);
    endOfDay.setHours(23, 59, 59, 999);

    return filteredTrips.filter((trip) => {
      const tripDate = new Date(trip.pickup_time);
      return tripDate >= startOfDay && tripDate <= endOfDay;
    });
  }, [filteredTrips, selectedDate]);

  // Count trips per day in week/month
  const tripCountByDay = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredTrips.forEach((trip) => {
      const dateKey = new Date(trip.pickup_time).toDateString();
      counts[dateKey] = (counts[dateKey] || 0) + 1;
    });
    return counts;
  }, [filteredTrips]);

  // Active trips (in progress)
  const activeTrips = useMemo(
    () => filteredTrips.filter((t) => t.status === "in_progress"),
    [filteredTrips]
  );

  // Navigation handlers
  const goToPrevious = () => {
    const newDate = new Date(selectedDate);
    if (isMonthExpanded) {
      newDate.setMonth(newDate.getMonth() - 1);
    } else {
      newDate.setDate(newDate.getDate() - 7);
    }
    setSelectedDate(newDate);
  };

  const goToNext = () => {
    const newDate = new Date(selectedDate);
    if (isMonthExpanded) {
      newDate.setMonth(newDate.getMonth() + 1);
    } else {
      newDate.setDate(newDate.getDate() + 7);
    }
    setSelectedDate(newDate);
  };

  const goToToday = () => {
    setSelectedDate(new Date());
  };

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
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="h-9 px-3 gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          {onCreateClick && (
            <Button
              onClick={onCreateClick}
              className="bg-[#3D5A3D] hover:bg-[#2E4A2E] text-white shadow-sm rounded-xl h-10 px-5"
            >
              <Plus className="w-4 h-4 mr-2" />
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
                {activeTrips.length}
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
                {filteredTrips.filter((t) => t.status === "pending").length}
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
                ? selectedDate.toLocaleDateString("en-US", {
                    month: "long",
                    year: "numeric",
                  })
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

          {/* View toggle */}
          <div className="flex items-center gap-2">
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
                    : "text-slate-500 hover:bg-slate-50"
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
                    : "text-slate-500 hover:bg-slate-50"
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
                    : "text-slate-500 hover:bg-slate-50"
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
            isMonthExpanded ? "mb-6" : "mb-2"
          )}
        >
          {calendarDates.map((date) => {
            const isSelected =
              date.toDateString() === selectedDate.toDateString();
            const isToday = date.toDateString() === new Date().toDateString();
            const isCurrentMonth = date.getMonth() === selectedDate.getMonth();
            const tripCount = tripCountByDay[date.toDateString()] || 0;

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
                  !isCurrentMonth && isMonthExpanded && "opacity-40 grayscale"
                )}
              >
                <span className="text-[10px] font-semibold uppercase tracking-wide opacity-70">
                  {date.toLocaleDateString("en-US", { weekday: "short" })}
                </span>
                <span className="text-lg font-bold mt-0.5">
                  {date.getDate()}
                </span>
                {tripCount > 0 && (
                  <span
                    className={cn(
                      "mt-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                      isSelected
                        ? "bg-white/20 text-white"
                        : "bg-slate-200 text-slate-600"
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
        {/* Mobile: Always show vertical timeline */}
        {isMobile ? (
          <TripTimelineVertical
            trips={filteredTrips}
            onTripClick={onTripClick}
            selectedDate={selectedDate}
            onQuickAdd={(patientId, patientName, date) =>
              setQuickAddData({ patientId, patientName, date })
            }
          />
        ) : viewMode === "timeline" ? (
          <TripTimeline
            trips={filteredTrips}
            onTripClick={onTripClick}
            selectedDate={selectedDate}
          />
        ) : viewMode === "cards" ? (
          <TripCardsView
            trips={tripsForDate}
            onTripClick={onTripClick}
            statusColors={statusColors}
            onQuickAdd={(patientId, patientName, date) =>
              setQuickAddData({ patientId, patientName, date })
            }
          />
        ) : (
          <TripListView
            trips={tripsForDate}
            onTripClick={onTripClick}
            statusColors={statusColors}
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

// Cards view component
function TripCardsView({
  trips,
  onTripClick,
  statusColors,
  onQuickAdd,
}: {
  trips: Trip[];
  onTripClick: (id: string) => void;
  statusColors: Record<TripStatus, string>;
  onQuickAdd: (patientId: string, patientName: string, date: Date) => void;
}) {
  const groupedTrips = useMemo(() => {
    const groups: Record<string, Trip[]> = {};
    trips.forEach((trip) => {
      const key = trip.patient_id || "unknown";
      if (!groups[key]) groups[key] = [];
      groups[key].push(trip);
    });
    return Object.values(groups).sort((a, b) => {
      const timeA = new Date(a[0]?.pickup_time || 0).getTime();
      const timeB = new Date(b[0]?.pickup_time || 0).getTime();
      return timeA - timeB;
    });
  }, [trips]);

  if (trips.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mb-4">
          <CalendarIcon className="w-6 h-6 text-slate-300" />
        </div>
        <p className="text-slate-500">No trips for this date</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {groupedTrips.map((group) => {
        const patient = group[0].patient;
        const sortedGroup = [...group].sort(
          (a, b) =>
            new Date(a.pickup_time).getTime() -
            new Date(b.pickup_time).getTime()
        );

        return (
          <div
            key={group[0].patient_id || "unknown"}
            className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden"
          >
            {/* Patient Header */}
            <div className="p-4 border-b border-slate-50 bg-slate-50/50 flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center shrink-0 shadow-sm">
                <User className="w-5 h-5 text-slate-700" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-slate-900 truncate">
                    {patient?.full_name || "Unknown Patient"}
                  </p>
                  <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full font-medium">
                    {group.length} Trip{group.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-medium">
                  {patient?.phone}
                </p>
              </div>
            </div>

            {/* Trips Timeline */}
            <div className="p-4 space-y-0 relative">
              {/* Vertical Timeline Line */}
              {sortedGroup.length > 1 && (
                <div className="absolute left-[29px] top-4 bottom-8 w-0.5 bg-slate-100" />
              )}

              {sortedGroup.map((trip, index) => (
                <div
                  key={trip.id}
                  onClick={() => onTripClick(trip.id)}
                  className="relative pl-8 pb-6 last:pb-0 z-10 cursor-pointer group"
                >
                  {/* Timeline Node */}
                  <div
                    className={cn(
                      "absolute left-0 top-1 w-7 h-7 rounded-full border-2 flex items-center justify-center bg-white transition-colors",
                      trip.status === "completed"
                        ? "border-emerald-500 text-emerald-500"
                        : trip.status === "in_progress"
                        ? "border-blue-500 text-blue-500"
                        : trip.status === "cancelled"
                        ? "border-red-200 text-red-300"
                        : "border-slate-300 text-slate-400 group-hover:border-blue-400 group-hover:text-blue-400"
                    )}
                  >
                    {index + 1}
                  </div>

                  {/* Trip Card Content */}
                  <div className="bg-slate-50/50 rounded-lg border border-slate-100 p-3 hover:bg-white hover:shadow-md hover:border-blue-200 transition-all">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-bold text-slate-700 font-mono">
                        {new Date(trip.pickup_time).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-wide border",
                          statusColors[trip.status]
                        )}
                      >
                        {trip.status.replace("_", " ")}
                      </span>
                    </div>

                    <div className="text-xs text-slate-500 mb-2 font-medium uppercase tracking-wider">
                      {trip.trip_type}
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex items-start gap-2">
                        <MapPin className="w-3.5 h-3.5 text-red-500 mt-0.5 shrink-0" />
                        <span className="text-slate-700 leading-tight">
                          {trip.pickup_location}
                        </span>
                      </div>
                      <div className="flex items-start gap-2">
                        <MapPin className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
                        <span className="text-slate-700 leading-tight">
                          {trip.dropoff_location}
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-200/50 flex items-center gap-2">
                      <Car className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-xs text-slate-600 font-medium">
                        {trip.driver?.full_name || "Unassigned"}
                      </span>
                    </div>
                  </div>
                </div>
              ))}

              {/* Quick Add Leg Button */}
              <div className="relative pl-8 pt-2">
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    const date = new Date(sortedGroup[0].pickup_time);
                    onQuickAdd(
                      sortedGroup[0].patient_id,
                      patient?.full_name || "Patient",
                      date
                    );
                  }}
                  variant="ghost"
                  className="w-full h-auto min-h-[44px] py-2.5 border-2 border-dashed border-slate-100 rounded-xl text-slate-400 hover:text-blue-600 hover:border-blue-100 hover:bg-blue-50/50 transition-all flex items-center justify-center gap-2 group"
                >
                  <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-white border-2 border-slate-100 flex items-center justify-center group-hover:border-blue-400 group-hover:text-blue-400 transition-colors flex-shrink-0">
                    <Plus className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-wider whitespace-nowrap">
                    Add Leg
                  </span>
                </Button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// List view component
function TripListView({
  trips,
  onTripClick,
  statusColors,
}: {
  trips: Trip[];
  onTripClick: (id: string) => void;
  statusColors: Record<TripStatus, string>;
}) {
  if (trips.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mb-4">
          <List className="w-6 h-6 text-slate-300" />
        </div>
        <p className="text-slate-500">No trips for this date</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-100">
            <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Time
            </th>
            <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Patient
            </th>
            <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Type
            </th>
            <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Pickup
            </th>
            <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Driver
            </th>
            <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Status
            </th>
          </tr>
        </thead>
        <tbody>
          {trips.map((trip) => (
            <tr
              key={trip.id}
              onClick={() => onTripClick(trip.id)}
              className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer transition-colors"
            >
              <td className="py-3 px-4">
                <span className="text-sm font-medium text-slate-900">
                  {new Date(trip.pickup_time).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </td>
              <td className="py-3 px-4">
                <span className="text-sm text-slate-900">
                  {trip.patient?.full_name || "Unknown"}
                </span>
              </td>
              <td className="py-3 px-4">
                <span className="text-sm text-slate-600">{trip.trip_type}</span>
              </td>
              <td className="py-3 px-4">
                <span className="text-sm text-slate-600 max-w-[200px] truncate block">
                  {trip.pickup_location}
                </span>
              </td>
              <td className="py-3 px-4">
                <div className="flex items-center gap-2">
                  <Car className="w-4 h-4 text-slate-400" />
                  <span className="text-sm text-slate-600">
                    {trip.driver?.full_name || "Unassigned"}
                  </span>
                </div>
              </td>
              <td className="py-3 px-4">
                <span
                  className={cn(
                    "px-2.5 py-0.5 rounded-full text-xs font-semibold border",
                    statusColors[trip.status]
                  )}
                >
                  {trip.status.replace("_", " ").toUpperCase()}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
