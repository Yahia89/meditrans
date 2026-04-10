import { Button } from "@/components/ui/button";
import { ArrowClockwise, CloudArrowUp, Plus } from "@phosphor-icons/react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TripsSchedulerProps } from "./types";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/contexts/auth-context";

interface SchedulerHeaderProps extends Pick<TripsSchedulerProps, "onCreateClick" | "onDischargeClick" | "onBulkImportClick"> {
  onRefresh: () => void;
  isFetching?: boolean;
}

export function SchedulerHeader({
  onCreateClick,
  onDischargeClick,
  onBulkImportClick,
  onRefresh,
  isFetching,
}: SchedulerHeaderProps) {
  const { isDriver } = usePermissions();
  const { profile } = useAuth();

  return (
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
          onClick={onRefresh}
          className="h-10 px-4 gap-2 border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl font-medium"
        >
          <ArrowClockwise className={cn("w-4 h-4", isFetching && "animate-spin")} />
          <span className="hidden sm:inline">
            {isFetching ? "Syncing..." : "Refresh"}
          </span>
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
  );
}
