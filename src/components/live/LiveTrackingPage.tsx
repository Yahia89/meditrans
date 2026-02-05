import { useState } from "react";
import { Loader2 } from "lucide-react";
import {
  MagnifyingGlass,
  NavigationArrow,
  CarProfile,
  WarningCircle,
} from "@phosphor-icons/react";
import { useLiveTracking } from "./useLiveTracking";
import { LiveMap } from "./LiveMap";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/auth-context";
import { useOrganization } from "@/contexts/OrganizationContext";
import { getActiveTimezone, formatInUserTimezone } from "@/lib/timezone";
import { useMemo } from "react";
import { usePermissions } from "@/hooks/usePermissions";
import { useQueryState } from "nuqs";
import { Pencil } from "@phosphor-icons/react";

export function LiveTrackingPage() {
  const { profile } = useAuth();
  const { currentOrganization } = useOrganization();

  const activeTimezone = useMemo(
    () => getActiveTimezone(profile, currentOrganization),
    [profile, currentOrganization],
  );

  const {
    drivers,
    trips,
    loading,
    setRouteForTrip,
    getRouteForTrip,
    getDriverRouteState,
    clearRerouteFlag,
    routeFollowingStates,
  } = useLiveTracking();
  const { canManageTrips } = usePermissions();
  const [_, setPage] = useQueryState("page");
  const [__, setTripId] = useQueryState("tripId");
  const [___, setFromPage] = useQueryState("from");
  const [____, setSection] = useQueryState("section");
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"drivers" | "trips">("drivers");

  // Filtering
  const filteredDrivers = drivers.filter((d) =>
    d.full_name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const activeDrivers = filteredDrivers.filter((d) => d.status === "en_route");
  const idleDrivers = filteredDrivers.filter((d) => d.status === "idle");
  const offlineDrivers = filteredDrivers.filter((d) => d.status === "offline");

  const filteredTrips = trips.filter(
    (t) =>
      t.patient?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.driver?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const handleDriverSelect = (id: string) => {
    setSelectedDriverId(id);
  };

  /**
   * Callback when LiveMap fetches directions
   * We cache the polyline for route-aware animation
   */
  const handleRouteLoad = (
    tripId: string,
    directions: google.maps.DirectionsResult,
    origin: string,
    destination: string,
  ) => {
    setRouteForTrip(tripId, directions, origin, destination);
  };

  if (loading && drivers.length === 0) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          <p className="text-slate-500 font-medium">
            Connecting to Fleet Command...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col lg:flex-row gap-4 p-4">
      {/* Map Area - Main Content */}
      <div className="flex-1 rounded-xl bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden relative">
        <LiveMap
          drivers={drivers}
          trips={trips}
          selectedDriverId={selectedDriverId}
          onDriverSelect={handleDriverSelect}
          onRouteLoad={handleRouteLoad}
          getDriverRouteState={getDriverRouteState}
          clearRerouteFlag={clearRerouteFlag}
          getRoutePolyline={(tripId) =>
            getRouteForTrip(tripId)?.polyline ?? null
          }
          routeFollowingStates={routeFollowingStates}
        />

        {/* Floating Stats Overlay */}
        <div className="absolute top-4 left-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm p-3 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 flex flex-col gap-1 z-[1] min-w-[180px]">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Fleet Status
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Active Trips
            </span>
            <span className="text-sm font-bold text-blue-600">
              {trips.length}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Drivers Online
            </span>
            <span className="text-sm font-bold text-emerald-600">
              {activeDrivers.length + idleDrivers.length}{" "}
              <span className="text-slate-400 font-normal">
                / {drivers.length}
              </span>
            </span>
          </div>
        </div>
      </div>

      {/* Sidebar - Control Panel */}
      <div className="w-full lg:w-96 flex flex-col gap-0 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden h-full">
        <div className="p-4 border-b border-slate-100 dark:border-slate-700 space-y-3">
          <h2 className="font-semibold text-lg flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            Live Operations
          </h2>
          <div className="relative">
            <MagnifyingGlass className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search drivers, trips..."
              className="pl-9 bg-slate-50 dark:bg-slate-900 border-none"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex p-1 bg-slate-100 dark:bg-slate-900 rounded-lg">
            <button
              onClick={() => setActiveTab("drivers")}
              className={cn(
                "flex-1 py-1.5 text-sm font-medium rounded-md transition-all",
                activeTab === "drivers"
                  ? "bg-white dark:bg-slate-800 text-blue-600 shadow-sm"
                  : "text-slate-500 hover:text-slate-700",
              )}
            >
              Drivers ({filteredDrivers.length})
            </button>
            <button
              onClick={() => setActiveTab("trips")}
              className={cn(
                "flex-1 py-1.5 text-sm font-medium rounded-md transition-all",
                activeTab === "trips"
                  ? "bg-white dark:bg-slate-800 text-blue-600 shadow-sm"
                  : "text-slate-500 hover:text-slate-700",
              )}
            >
              Active Trips ({filteredTrips.length})
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 scrollbar-hide">
          {activeTab === "drivers" ? (
            <div className="space-y-4">
              {activeDrivers.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-2 mb-2 mt-2">
                    En Route
                  </div>
                  <div className="space-y-1">
                    {activeDrivers.map((driver) => (
                      <DriverCard
                        key={driver.id}
                        driver={driver}
                        isSelected={selectedDriverId === driver.id}
                        onClick={() => handleDriverSelect(driver.id)}
                        timezone={activeTimezone}
                      />
                    ))}
                  </div>
                </div>
              )}

              {idleDrivers.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-2 mb-2 mt-4">
                    Available
                  </div>
                  <div className="space-y-1">
                    {idleDrivers.map((driver) => (
                      <DriverCard
                        key={driver.id}
                        driver={driver}
                        isSelected={selectedDriverId === driver.id}
                        onClick={() => handleDriverSelect(driver.id)}
                        timezone={activeTimezone}
                      />
                    ))}
                  </div>
                </div>
              )}

              {offlineDrivers.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-2 mb-2 mt-4">
                    Offline
                  </div>
                  <div className="space-y-1">
                    {offlineDrivers.map((driver) => (
                      <DriverCard
                        key={driver.id}
                        driver={driver}
                        isSelected={selectedDriverId === driver.id}
                        onClick={() => handleDriverSelect(driver.id)}
                        timezone={activeTimezone}
                      />
                    ))}
                  </div>
                </div>
              )}

              {filteredDrivers.length === 0 && (
                <div className="text-center py-10 text-slate-400 text-sm">
                  No drivers found
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredTrips.map((trip) => (
                <TripCard
                  key={trip.id}
                  trip={trip}
                  onClick={() =>
                    trip.driver_id && handleDriverSelect(trip.driver_id)
                  }
                  onEdit={() => {
                    setTripId(trip.id);
                    setFromPage("live");
                    setSection("tracking");
                    setPage("trip-details");
                  }}
                  canEdit={canManageTrips}
                  timezone={activeTimezone}
                />
              ))}
              {filteredTrips.length === 0 && (
                <div className="text-center py-10 text-slate-400 text-sm">
                  No active trips
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DriverCard({
  driver,
  isSelected,
  onClick,
  timezone,
}: {
  driver: any;
  isSelected: boolean;
  onClick: () => void;
  timezone: string;
}) {
  const isEnRoute = driver.status === "en_route";
  // isOffline is implicitly handled in the ternary fallback for statusColor
  const isIdle = driver.status === "idle";

  // Status Colors Mapping
  const statusColor = isEnRoute
    ? "bg-purple-100 text-purple-700 border-purple-200"
    : isIdle
      ? "bg-emerald-50 text-emerald-700 border-emerald-100"
      : "bg-slate-100 text-slate-500 border-slate-200";

  const iconBg = isEnRoute
    ? "bg-purple-500"
    : isIdle
      ? "bg-emerald-500"
      : "bg-slate-400";

  return (
    <div
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all border",
        isSelected
          ? "bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800"
          : "bg-white border-transparent hover:bg-slate-50 hover:border-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700",
      )}
    >
      <div
        className={cn(
          "w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-white shadow-sm",
          iconBg,
        )}
      >
        {isEnRoute ? (
          <NavigationArrow weight="fill" className="w-5 h-5" />
        ) : (
          <CarProfile weight="fill" className="w-5 h-5" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-slate-900 dark:text-slate-100 truncate">
          {driver.full_name}
        </div>
        <div className="flex items-center gap-2 text-xs mt-1">
          <span
            className={cn(
              "px-2 py-0.5 rounded-full border text-[10px] font-semibold uppercase tracking-wide",
              statusColor,
            )}
          >
            {driver.status === "en_route"
              ? "En Route"
              : driver.status === "idle"
                ? "Available"
                : "Offline"}
          </span>
          {driver.last_location_update && (
            <span className="text-slate-400 text-[10px] truncate">
              {formatInUserTimezone(
                driver.last_location_update,
                timezone,
                "h:mm a",
              )}
            </span>
          )}
        </div>
      </div>
      {isSelected && <div className="w-1.5 h-1.5 bg-blue-500 rounded-full" />}
    </div>
  );
}

function TripCard({
  trip,
  onClick,
  onEdit,
  canEdit,
  timezone,
}: {
  trip: any;
  onClick: () => void;
  onEdit: () => void;
  canEdit: boolean;
  timezone: string;
}) {
  return (
    <div
      onClick={onClick}
      className="p-3 rounded-lg border border-slate-100 hover:border-blue-200 bg-white shadow-sm hover:shadow-md transition-all cursor-pointer group"
    >
      <div className="flex justify-between items-start mb-2">
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
          {trip.status === "en_route" ? "EN ROUTE" : "IN PROGRESS"}
        </span>
        <span className="text-[10px] text-slate-400">
          {formatInUserTimezone(trip.pickup_time, timezone, "h:mm a")}
        </span>
        {canEdit && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="p-1 rounded-md hover:bg-slate-100 text-slate-400 hover:text-blue-600 transition-colors"
          >
            <Pencil size={14} weight="bold" />
          </button>
        )}
      </div>

      <div className="space-y-2 text-sm">
        <div className="flex items-start gap-2">
          <div className="w-1 h-full min-h-[24px] rounded-full bg-slate-200 relative top-1">
            <div className="absolute top-0 w-full h-1/2 bg-blue-400 rounded-full" />
          </div>
          <div className="flex-1 space-y-2">
            <div className="space-y-0.5">
              <div className="text-xs text-slate-400">PICKUP from</div>
              <div className="font-medium text-slate-700 line-clamp-1">
                {trip.pickup_location}
              </div>
            </div>
            <div className="space-y-0.5">
              <div className="text-xs text-slate-400">DROPOFF to</div>
              <div className="font-medium text-slate-700 line-clamp-1">
                {trip.dropoff_location}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 pt-2 border-t border-slate-50 flex items-center justify-between text-xs text-slate-500">
        <div className="flex items-center gap-1">
          <CarProfile className="w-3.5 h-3.5" />
          {trip.driver?.full_name || "Unassigned"}
        </div>
        <div className="flex items-center gap-1">
          <WarningCircle className="w-3.5 h-3.5" />
          Patient: {trip.patient?.full_name}
        </div>
      </div>
    </div>
  );
}
