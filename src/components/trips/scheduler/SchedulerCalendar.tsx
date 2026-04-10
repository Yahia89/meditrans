import { memo } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatInUserTimezone } from "@/lib/timezone";
import { toZonedTime } from "date-fns-tz";

interface SchedulerCalendarProps {
  calendarDates: Date[];
  selectedDate: Date;
  selectedDateStr: string;
  todayStr: string;
  timezone: string;
  isMonthExpanded: boolean;
  onDateSelect: (date: Date) => void;
  onToggleExpand: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
  tripCountByDay: Record<string, number>;
}

export const SchedulerCalendar = memo(function SchedulerCalendar({
  calendarDates,
  selectedDate,
  selectedDateStr,
  todayStr,
  timezone,
  isMonthExpanded,
  onDateSelect,
  onToggleExpand,
  onPrevious,
  onNext,
  onToday,
  tripCountByDay,
}: SchedulerCalendarProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 transition-all duration-300 ease-in-out relative">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onPrevious} className="h-8 w-8 p-0">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onToday}
            className="h-8 px-3 text-xs font-medium"
          >
            {isMonthExpanded
              ? formatInUserTimezone(selectedDate, timezone, "MMMM yyyy")
              : "Today"}
          </Button>
          <Button variant="ghost" size="sm" onClick={onNext} className="h-8 w-8 p-0">
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div
        className={cn(
          "grid grid-cols-7 gap-2 mt-4 transition-all duration-300",
          isMonthExpanded ? "mb-6" : "mb-2"
        )}
      >
        {calendarDates.map((date) => {
          const dateStr = formatInUserTimezone(date, timezone, "yyyy-MM-dd");
          const isSelected = dateStr === selectedDateStr;
          const isToday = dateStr === todayStr;

          const zonedDate = toZonedTime(date, timezone);
          const zonedSelected = toZonedTime(selectedDate, timezone);
          const isCurrentMonth =
            zonedDate.getMonth() === zonedSelected.getMonth() &&
            zonedDate.getFullYear() === zonedSelected.getFullYear();

          const tripCount = tripCountByDay[dateStr] || 0;

          return (
            <button
              key={date.toISOString()}
              onClick={() => onDateSelect(date)}
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
                {formatInUserTimezone(date, timezone, "EEE")}
              </span>
              <span className="text-lg font-bold mt-0.5">{zonedDate.getDate()}</span>
              {tripCount > 0 && (
                <span
                  className={cn(
                    "mt-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                    isSelected ? "bg-white/20 text-white" : "bg-slate-200 text-slate-600"
                  )}
                >
                  {tripCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="absolute bottom-0 left-0 right-0 flex justify-center translate-y-1/2 z-20">
        <Button
          variant="outline"
          size="sm"
          onClick={onToggleExpand}
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
  );
});
