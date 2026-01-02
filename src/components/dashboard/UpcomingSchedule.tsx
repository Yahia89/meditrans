import {
  CalendarBlank,
  CaretLeft,
  CaretRight,
  Clock,
  MapPin,
  CircleNotch,
  CaretDown,
  CaretUp,
} from "@phosphor-icons/react";
import {
  format,
  startOfWeek,
  addDays,
  isSameDay,
  isSameMonth,
  startOfMonth,
  eachDayOfInterval,
} from "date-fns";
import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useOrganization } from "@/contexts/OrganizationContext";
import { Button } from "@/components/ui/button";
import { useQueryState } from "nuqs";

export function UpcomingSchedule() {
  const { currentOrganization } = useOrganization();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isMonthExpanded, setIsMonthExpanded] = useState(false);
  const [_, setPage] = useQueryState("page");
  const [__, setTripId] = useQueryState("tripId");
  const [___, setFromPage] = useQueryState("from");
  const [____, setSection] = useQueryState("section");

  // Calendar logic
  const calendarDates = useMemo(() => {
    if (isMonthExpanded) {
      const start = startOfMonth(selectedDate);
      const weekStart = startOfWeek(start, { weekStartsOn: 1 });
      const weekEnd = addDays(weekStart, 41); // 6 weeks grid
      return eachDayOfInterval({ start: weekStart, end: weekEnd });
    } else {
      const start = startOfWeek(selectedDate, { weekStartsOn: 1 });
      return Array.from({ length: 7 }, (_, i) => addDays(start, i));
    }
  }, [selectedDate, isMonthExpanded]);

  // Fetch trip counts for the calendar
  const { data: tripCounts = {} } = useQuery({
    queryKey: [
      "trip-counts",
      currentOrganization?.id,
      calendarDates[0].toISOString(),
      calendarDates[calendarDates.length - 1].toISOString(),
    ],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trips")
        .select("pickup_time")
        .eq("org_id", currentOrganization?.id)
        .gte("pickup_time", calendarDates[0].toISOString())
        .lte(
          "pickup_time",
          calendarDates[calendarDates.length - 1].toISOString()
        );

      if (error) throw error;

      const counts: Record<string, number> = {};
      data.forEach((trip) => {
        const dateStr = format(new Date(trip.pickup_time), "yyyy-MM-dd");
        counts[dateStr] = (counts[dateStr] || 0) + 1;
      });
      return counts;
    },
    enabled: !!currentOrganization,
  });

  // Fetch trips for selected date
  const { data: trips, isLoading } = useQuery({
    queryKey: [
      "upcoming-trips",
      currentOrganization?.id,
      selectedDate.toLocaleDateString(),
    ],
    queryFn: async () => {
      const start = new Date(selectedDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(selectedDate);
      end.setHours(23, 59, 59, 999);

      const { data, error } = await supabase
        .from("trips")
        .select(
          `
          id,
          pickup_time,
          status,
          pickup_location,
          patient:patients(full_name),
          driver:drivers(full_name)
        `
        )
        .eq("org_id", currentOrganization?.id)
        .gte("pickup_time", start.toISOString())
        .lte("pickup_time", end.toISOString())
        .order("pickup_time", { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: !!currentOrganization,
  });

  const handlePrev = () => {
    setSelectedDate(addDays(selectedDate, isMonthExpanded ? -30 : -7));
  };
  const handleNext = () => {
    setSelectedDate(addDays(selectedDate, isMonthExpanded ? 30 : 7));
  };

  const handleTripClick = (id: string) => {
    setTripId(id);
    setFromPage("dashboard");
    setSection("schedule");
    setPage("trip-details");
  };

  return (
    <div className="bg-white rounded-2xl p-8 border border-slate-100 shadow-sm relative">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Operational Schedule
          </h2>
          <p className="text-sm font-medium text-slate-500 mt-0.5">
            {format(selectedDate, "MMMM yyyy")}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handlePrev}
            className="p-2.5 rounded-xl border border-slate-100 hover:bg-slate-50 transition-all active:scale-95"
          >
            <CaretLeft size={20} weight="bold" />
          </button>
          <button
            onClick={handleNext}
            className="p-2.5 rounded-xl border border-slate-100 hover:bg-slate-50 transition-all active:scale-95"
          >
            <CaretRight size={20} weight="bold" />
          </button>
        </div>
      </div>

      <div
        className={cn(
          "grid grid-cols-7 gap-2 transition-all duration-300",
          isMonthExpanded ? "mb-10" : "mb-8"
        )}
      >
        {calendarDates.map((day) => {
          const isSelected = isSameDay(day, selectedDate);
          const isCurrentMonth = isSameMonth(day, selectedDate);
          const dateStr = format(day, "yyyy-MM-dd");
          const count = tripCounts[dateStr] || 0;

          return (
            <button
              key={day.toISOString()}
              onClick={() => setSelectedDate(day)}
              className={cn(
                "group flex flex-col items-center py-4 rounded-2xl transition-all border-2",
                isSelected
                  ? "bg-lime-200 border-lime-300 text-slate-900 shadow-sm shadow-lime-100"
                  : "bg-white border-transparent hover:bg-slate-50 hover:border-slate-100",
                !isCurrentMonth && !isSelected && "opacity-30 grayscale"
              )}
            >
              <span
                className={cn(
                  "text-[10px] font-black uppercase tracking-widest mb-1.5 transition-colors",
                  isSelected
                    ? "text-slate-900"
                    : "text-slate-400 group-hover:text-slate-600"
                )}
              >
                {format(day, "EEE")}
              </span>
              <span className="text-lg font-bold tabular-nums">
                {format(day, "d")}
              </span>
              {count > 0 && (
                <div
                  className={cn(
                    "mt-2 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black",
                    isSelected
                      ? "bg-white/40 text-slate-900"
                      : "bg-lime-100 text-lime-700"
                  )}
                >
                  {count}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Shy Toggle - Styled button */}
      <div className="absolute left-1/2 -translate-x-1/2 -bottom-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsMonthExpanded(!isMonthExpanded)}
          className="rounded-full px-6 bg-white shadow-md border-slate-200 hover:bg-slate-50 transition-all font-bold group"
        >
          {isMonthExpanded ? (
            <div className="flex items-center gap-2">
              <CaretUp size={14} weight="bold" />
              <span>Compact View</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <CaretDown size={14} weight="bold" />
              <span>Full Calendar</span>
            </div>
          )}
        </Button>
      </div>

      <div className="mt-4 pt-4 border-t border-slate-50 space-y-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <CircleNotch size={32} className="animate-spin text-lime-500" />
          </div>
        ) : !trips || trips.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-slate-100/50 shadow-inner">
              <CalendarBlank size={32} className="text-slate-300" />
            </div>
            <p className="text-slate-500 font-bold">No trips scheduled.</p>
            <p className="text-xs text-slate-400 max-w-[180px] mt-1">
              Select an active date or create a new trip request.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            {trips.map((trip) => (
              <div
                key={trip.id}
                onClick={() => handleTripClick(trip.id)}
                className="flex items-center gap-4 p-5 rounded-2xl border border-slate-100 hover:shadow-md hover:border-lime-200 transition-all bg-white group/item cursor-pointer"
              >
                <div className="bg-lime-50 text-lime-700 w-12 h-12 rounded-xl flex flex-col items-center justify-center shrink-0 border border-lime-100">
                  <span className="text-xs font-black leading-none uppercase">
                    {format(new Date(trip.pickup_time), "HH:mm")}
                  </span>
                  <Clock size={16} weight="bold" className="mt-0.5" />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-900 truncate">
                    {(trip.patient as any)?.full_name || "Unknown Patient"}
                  </p>
                  <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400 mt-1">
                    <MapPin
                      size={14}
                      weight="fill"
                      className="text-red-400/70"
                    />
                    <span className="truncate">{trip.pickup_location}</span>
                  </div>
                </div>

                <div className="text-right hidden sm:block">
                  <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1">
                    Operator
                  </p>
                  <p className="text-sm font-bold text-slate-700">
                    {(trip.driver as any)?.full_name || "Unassigned"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
