import { Search, Loader2, Calendar as CalendarIcon, LayoutGrid, List } from "lucide-react";
import { Input } from "@/components/ui/input";
import { TimezoneSelector } from "../../timezone-selector";
import { cn } from "@/lib/utils";
import type { TripStatus } from "../types";
import type { ViewMode } from "./types";

interface SchedulerControlsProps {
  timezone: string;
  onTimezoneChange: (tz: string) => void;
  isUpdatingTimezone: boolean;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  statusFilter: TripStatus | "all";
  onStatusFilterChange: (status: TripStatus | "all") => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}

export function SchedulerControls({
  timezone,
  onTimezoneChange,
  isUpdatingTimezone,
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  viewMode,
  onViewModeChange,
}: SchedulerControlsProps) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div className="flex flex-wrap items-center gap-2 flex-1">
        <div className="flex items-center bg-slate-100 rounded-lg p-1 mr-2 relative">
          <TimezoneSelector
            value={timezone}
            onValueChange={onTimezoneChange}
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
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search trips..."
            className="pl-9 h-9"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => onStatusFilterChange(e.target.value as TripStatus | "all")}
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
          <ViewToggleButton
            active={viewMode === "timeline"}
            onClick={() => onViewModeChange("timeline")}
            icon={<CalendarIcon className="w-4 h-4" />}
          />
          <ViewToggleButton
            active={viewMode === "cards"}
            onClick={() => onViewModeChange("cards")}
            icon={<LayoutGrid className="w-4 h-4" />}
          />
          <ViewToggleButton
            active={viewMode === "list"}
            onClick={() => onViewModeChange("list")}
            icon={<List className="w-4 h-4" />}
          />
        </div>
      </div>
    </div>
  );
}

function ViewToggleButton({ active, onClick, icon }: { active: boolean; onClick: () => void; icon: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "h-9 px-3 text-sm flex items-center gap-1.5 transition-colors",
        active ? "bg-slate-100 text-slate-900" : "text-slate-500 hover:bg-slate-50"
      )}
    >
      {icon}
    </button>
  );
}
