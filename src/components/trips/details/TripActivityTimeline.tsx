import type { Trip, TripStatusHistory } from "../types";
import { cn } from "@/lib/utils";
import { formatInUserTimezone } from "@/lib/timezone";
import {
  CheckCircle,
  Warning,
  Clock,
  Car,
  PencilSimpleLine,
  Signature,
  Calendar,
  ArrowsClockwise,
  Path,
} from "@phosphor-icons/react";
import { useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";

interface ActivityTimelineProps {
  trip: Trip;
  history: TripStatusHistory[] | undefined;
  activeTimezone: string;
  isHistoryLoading?: boolean;
}

export function TripActivityTimeline({ 
  trip, 
  history, 
  activeTimezone,
  isHistoryLoading,
}: ActivityTimelineProps) {
  const timelineEvents = useMemo(() => {
    const events: Array<{
      id: string;
      status: string;
      actor_name: string;
      created_at: string;
    }> = [];

    // Add real history events first
    if (history && history.length > 0) {
      history.forEach((item) => {
        events.push({
          id: item.id,
          status: item.status,
          actor_name: item.actor_name,
          created_at: item.created_at,
        });
      });
    }

    // Current status event - only show if history doesn't already capture the latest change
    const hasHistoryForStatus = (status: string) =>
      events.some((e) => e.status.toLowerCase().includes(status.toLowerCase()));

    if (trip?.status && !hasHistoryForStatus(trip.status)) {
      events.push({
        id: `current-${trip.status}`,
        status: trip.status.toUpperCase(),
        actor_name: trip.driver?.full_name || "System",
        created_at: trip.updated_at || trip.created_at,
      });
    }

    // Sort by date descending (most recent first)
    return events.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  }, [history, trip]);

  // While history is loading, render a height-stable skeleton so the card
  // occupies its space immediately and siblings don't shift when data arrives.
  // We use the trip's own status to show at least one real synthesised row
  // once the trip itself is in cache, giving immediate visual feedback.
  if (isHistoryLoading && !history) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <Skeleton className="h-3 w-36 rounded mb-6" />
        <div className="space-y-5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="w-8 h-8 rounded-lg shrink-0" />
              <div className="flex-1 space-y-1.5 pt-0.5">
                <Skeleton className="h-3.5 w-2/3 rounded" />
                <Skeleton className="h-3 w-1/3 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
      <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-6">
        Activity Timeline
      </h3>
      <div className="space-y-5">
        {timelineEvents.map((item, idx) => {
          // Determine event type for styling
          const isUpdate = item.status.includes("UPDATED");
          const isCreated = item.status.toLowerCase().includes("created");
          const isAssigned = item.status
            .toLowerCase()
            .includes("assigned");
          const isCompleted = item.status.toLowerCase() === "completed";
          const isRequest = item.status.includes("REQUEST");
          const isCancelOrReject =
            item.status.includes("CANCEL") ||
            item.status.includes("REJECTED");
          const isSignature = item.status
            .toLowerCase()
            .includes("signature");

          // Extract distance from update message if present
          const distanceMatch = item.status.match(
            /DISTANCE:\s*([\d.]+)\s*MILES?/i,
          );
          const distance = distanceMatch
            ? parseFloat(distanceMatch[1])
            : null;

          // Clean up the status text for display
          let displayStatus = item.status.replace(/_/g, " ");
          if (isUpdate) {
            displayStatus = displayStatus.replace("UPDATED:", "").trim();
          }

          return (
            <div key={item.id} className="relative flex gap-3">
              {idx !== timelineEvents.length - 1 && (
                <div className="absolute left-[15px] top-10 bottom-[-20px] w-0.5 bg-slate-100" />
              )}

              {/* Event Icon */}
              <div
                className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border transition-all duration-300",
                  isCompleted
                    ? "bg-emerald-50 border-emerald-200"
                    : isCancelOrReject
                      ? "bg-red-50 border-red-200"
                      : isRequest
                        ? "bg-amber-50 border-amber-200"
                        : isAssigned
                          ? "bg-blue-50 border-blue-200"
                          : isUpdate
                            ? "bg-slate-50 border-slate-200"
                            : isSignature
                              ? "bg-indigo-50 border-indigo-200"
                              : isCreated
                                ? "bg-slate-50 border-slate-200"
                                : "bg-slate-50 border-slate-150",
                )}
              >
                {isCompleted ? (
                  <CheckCircle
                    weight="duotone"
                    className="w-4 h-4 text-emerald-600"
                  />
                ) : isCancelOrReject ? (
                  <Warning
                    weight="duotone"
                    className="w-4 h-4 text-red-500"
                  />
                ) : isRequest ? (
                  <Clock
                    weight="duotone"
                    className="w-4 h-4 text-amber-500"
                  />
                ) : isAssigned ? (
                  <Car
                    weight="duotone"
                    className="w-4 h-4 text-blue-500"
                  />
                ) : isUpdate ? (
                  <PencilSimpleLine
                    weight="duotone"
                    className="w-4 h-4 text-slate-400"
                  />
                ) : isSignature ? (
                  <Signature
                    weight="duotone"
                    className="w-4 h-4 text-indigo-500"
                  />
                ) : isCreated ? (
                  <Calendar
                    weight="duotone"
                    className="w-4 h-4 text-slate-400"
                  />
                ) : (
                  <ArrowsClockwise
                    weight="duotone"
                    className="w-4 h-4 text-slate-400"
                  />
                )}
              </div>

              {/* Event Content */}
              <div className="flex-1 min-w-0 pt-0.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    {isUpdate ? (
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Trip Updated
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {displayStatus.split(",").map((change, i) => {
                            const trimmed = change.trim();
                            const isDistanceChange = trimmed
                              .toLowerCase()
                              .includes("distance");
                            return (
                              <span
                                key={i}
                                className={cn(
                                  "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium",
                                  isDistanceChange
                                    ? "bg-blue-50 text-blue-600 border border-blue-100"
                                    : "bg-slate-100 text-slate-600",
                                )}
                              >
                                {isDistanceChange && (
                                  <Path
                                    weight="bold"
                                    className="w-3 h-3"
                                  />
                                )}
                                {trimmed}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <p
                        className={cn(
                          "text-sm font-bold uppercase tracking-tight",
                          isCompleted
                            ? "text-emerald-700"
                            : isCancelOrReject
                              ? "text-red-600"
                              : isRequest
                                ? "text-amber-600"
                                : "text-slate-800",
                        )}
                      >
                        {displayStatus}
                      </p>
                    )}
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      by{" "}
                      <span className="font-semibold text-slate-600">
                        {item.actor_name}
                      </span>
                    </p>
                  </div>
                  <time className="text-[10px] font-semibold text-slate-400 whitespace-nowrap shrink-0">
                    {formatInUserTimezone(
                      item.created_at,
                      activeTimezone,
                      "h:mm a",
                    )}
                    <span className="block text-[9px] font-normal text-slate-300">
                      {formatInUserTimezone(
                        item.created_at,
                        activeTimezone,
                        "MM/dd/yyyy",
                      )}
                    </span>
                  </time>
                </div>

                {/* Special display for distance if parsed */}
                {distance && !isUpdate && (
                  <div className="mt-1.5 inline-flex items-center gap-1.5 px-2 py-0.5 bg-blue-50 rounded text-xs font-semibold text-blue-600 border border-blue-100">
                    <Path weight="bold" className="w-3 h-3" />
                    {distance} miles
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
