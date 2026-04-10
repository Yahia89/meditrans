import { Loader2 } from "lucide-react";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { QuickAddLegDialog } from "./QuickAddLegDialog";
import { useTripsScheduler } from "./scheduler/useTripsScheduler";
import { SchedulerHeader } from "./scheduler/SchedulerHeader";
import { SchedulerStats } from "./scheduler/SchedulerStats";
import { SchedulerControls } from "./scheduler/SchedulerControls";
import { SchedulerCalendar } from "./scheduler/SchedulerCalendar";
import { SchedulerContent } from "./scheduler/SchedulerContent";
import { STATUS_COLORS } from "./scheduler/constants";
import type { TripsSchedulerProps } from "./scheduler/types";

/**
 * TripsScheduler component - Refactored and modularized.
 * Manages the layout and composition of the scheduling view.
 */
export function TripsScheduler(props: TripsSchedulerProps) {
  const { onTripClick, patientId, driverId } = props;
  const isMobile = useMediaQuery("(max-width: 767px)");

  const { state, actions, data } = useTripsScheduler({
    patientId,
    driverId,
  });

  // Only show full loading state for initial fetch with no data
  if (state.isLoading && !data.trips) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SchedulerHeader
        onCreateClick={props.onCreateClick}
        onDischargeClick={props.onDischargeClick}
        onBulkImportClick={props.onBulkImportClick}
        onRefresh={actions.refetch}
        isFetching={state.isFetching}
      />

      <SchedulerStats
        todayCount={data.stats.todayCount}
        activeCount={data.stats.activeCount}
        pendingCount={data.stats.pendingCount}
        totalCount={data.stats.totalCount}
      />

      <div className="space-y-4">
        <SchedulerControls
          timezone={state.profile?.timezone || ""}
          onTimezoneChange={actions.handleUpdateTimezone}
          isUpdatingTimezone={state.isUpdatingTimezone}
          searchQuery={state.searchQuery}
          onSearchChange={actions.setSearchQuery}
          statusFilter={state.statusFilter}
          onStatusFilterChange={actions.setStatusFilter}
          viewMode={state.viewMode}
          onViewModeChange={actions.setViewMode}
        />

        <SchedulerCalendar
          calendarDates={data.calendarDates}
          selectedDate={state.selectedDate}
          selectedDateStr={state.selectedDateStr}
          todayStr={state.todayStr}
          timezone={state.activeTimezone}
          isMonthExpanded={state.isMonthExpanded}
          onDateSelect={actions.setSelectedDate}
          onToggleExpand={() => actions.setIsMonthExpanded(!state.isMonthExpanded)}
          onPrevious={actions.goToPrevious}
          onNext={actions.goToNext}
          onToday={actions.goToToday}
          tripCountByDay={data.tripCountByDay}
        />
      </div>

      <SchedulerContent
        isMobile={isMobile}
        viewMode={state.viewMode}
        filteredTrips={data.filteredTrips}
        tripsForDate={data.tripsForDate}
        onTripClick={onTripClick}
        selectedDate={state.selectedDate}
        timezone={state.activeTimezone}
        onQuickAdd={actions.handleQuickAdd}
        statusColors={STATUS_COLORS}
      />

      {state.quickAddData && (
        <QuickAddLegDialog
          open={!!state.quickAddData}
          onOpenChange={(open) => !open && actions.setQuickAddData(null)}
          patientId={state.quickAddData.patientId}
          patientName={state.quickAddData.patientName}
          date={state.quickAddData.date}
          onSuccess={() => actions.refetch()}
        />
      )}
    </div>
  );
}
