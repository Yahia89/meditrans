import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useOrganization } from "@/contexts/OrganizationContext";
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
} from "lucide-react";
import type { Trip, TripStatus } from "./types";
import { cn } from "@/lib/utils";
import { TripTimeline, TripTimelineVertical } from "./TripTimeline";
import { Input } from "@/components/ui/input";

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

export function TripsScheduler({
  onCreateClick,
  onTripClick,
  patientId,
  driverId,
}: TripsSchedulerProps) {
  const { currentOrganization } = useOrganization();

  // View state
  const [viewMode, setViewMode] = useState<"timeline" | "list" | "cards">(
    "timeline"
  );
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<TripStatus | "all">("all");
  const [isMobile, setIsMobile] = useState(false);

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

  // Week dates for navigation
  const weekDates = useMemo(() => getWeekDates(selectedDate), [selectedDate]);

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

  // Count trips per day in week
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
  const goToPreviousWeek = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() - 7);
    setSelectedDate(newDate);
  };

  const goToNextWeek = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + 7);
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
          <h1 className="text-2xl font-bold text-slate-900">Trip Scheduler</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage and track all patient transportation
          </p>
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
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Week navigation */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={goToPreviousWeek}
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
              Today
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={goToNextWeek}
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

        {/* Week Days */}
        <div className="grid grid-cols-7 gap-2 mt-4">
          {weekDates.map((date) => {
            const isSelected =
              date.toDateString() === selectedDate.toDateString();
            const isToday = date.toDateString() === new Date().toDateString();
            const tripCount = tripCountByDay[date.toDateString()] || 0;

            return (
              <button
                key={date.toISOString()}
                onClick={() => setSelectedDate(date)}
                className={cn(
                  "relative flex flex-col items-center py-3 px-2 rounded-xl transition-all",
                  isSelected
                    ? "bg-[#3D5A3D] text-white shadow-lg"
                    : isToday
                    ? "bg-slate-100 text-slate-900"
                    : "hover:bg-slate-50 text-slate-600"
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
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 min-h-[400px]">
        {/* Mobile: Always show vertical timeline */}
        {isMobile ? (
          <TripTimelineVertical
            trips={filteredTrips}
            onTripClick={onTripClick}
            selectedDate={selectedDate}
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
          />
        ) : (
          <TripListView
            trips={tripsForDate}
            onTripClick={onTripClick}
            statusColors={statusColors}
          />
        )}
      </div>
    </div>
  );
}

// Cards view component
function TripCardsView({
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
          <CalendarIcon className="w-6 h-6 text-slate-300" />
        </div>
        <p className="text-slate-500">No trips for this date</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {trips.map((trip) => (
        <button
          key={trip.id}
          onClick={() => onTripClick(trip.id)}
          className="group bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all cursor-pointer overflow-hidden text-left"
        >
          <div className="p-4 border-b border-slate-50 flex items-center justify-between">
            <span
              className={cn(
                "px-2.5 py-0.5 rounded-full text-xs font-semibold border",
                statusColors[trip.status]
              )}
            >
              {trip.status.replace("_", " ").toUpperCase()}
            </span>
            <span className="text-xs font-medium text-slate-400">
              {trip.trip_type}
            </span>
          </div>
          <div className="p-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                <User className="w-4 h-4 text-slate-600" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">
                  {trip.patient?.full_name || "Unknown Patient"}
                </p>
                <p className="text-xs text-slate-500">{trip.patient?.phone}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-slate-600">
              <Clock className="w-4 h-4" />
              <span className="text-sm">
                {new Date(trip.pickup_time).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
            <div className="flex items-start gap-2 text-slate-600">
              <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-red-400" />
              <span className="text-sm line-clamp-1">
                {trip.pickup_location}
              </span>
            </div>
          </div>
        </button>
      ))}
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
