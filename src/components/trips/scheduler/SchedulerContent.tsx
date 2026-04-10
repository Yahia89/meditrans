import { TripTimeline, TripTimelineVertical } from "../TripTimeline";
import { TripCardsView } from "../TripCardsView";
import { TripListView } from "../TripListView";
import type { Trip, TripStatus } from "../types";
import type { ViewMode } from "./types";

interface SchedulerContentProps {
  isMobile: boolean;
  viewMode: ViewMode;
  filteredTrips: Trip[];
  tripsForDate: Trip[];
  onTripClick: (id: string) => void;
  selectedDate: Date;
  timezone: string;
  onQuickAdd: (pId: string, pName: string, date: Date) => void;
  statusColors: Record<TripStatus, string>;
}

export function SchedulerContent({
  isMobile,
  viewMode,
  filteredTrips,
  tripsForDate,
  onTripClick,
  selectedDate,
  timezone,
  onQuickAdd,
  statusColors,
}: SchedulerContentProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 min-h-[400px]">
      {isMobile ? (
        <TripTimelineVertical
          trips={filteredTrips}
          onTripClick={onTripClick}
          selectedDate={selectedDate}
          timezone={timezone}
          onQuickAdd={onQuickAdd}
        />
      ) : viewMode === "timeline" ? (
        <TripTimeline
          trips={filteredTrips}
          onTripClick={onTripClick}
          selectedDate={selectedDate}
          timezone={timezone}
        />
      ) : viewMode === "cards" ? (
        <TripCardsView
          trips={tripsForDate}
          onTripClick={onTripClick}
          statusColors={statusColors}
          timezone={timezone}
          onQuickAdd={onQuickAdd}
        />
      ) : (
        <TripListView
          trips={tripsForDate}
          onTripClick={onTripClick}
          statusColors={statusColors}
          timezone={timezone}
        />
      )}
    </div>
  );
}
