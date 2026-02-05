import { useCallback, useState, useEffect, useMemo, useRef } from "react";
import {
  GoogleMap,
  useLoadScript,
  OverlayView,
  Polyline,
  MarkerF,
  InfoWindowF,
} from "@react-google-maps/api";
import useSupercluster from "use-supercluster";
import type { LiveDriver, LiveTrip, DriverRouteFollowingState } from "./types";
import type { PolylinePoint } from "@/lib/geo";
import {
  Warning,
  CornersOut,
  CarProfile,
  NavigationArrow,
  Info,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

// ============================================================================
// CONSTANTS
// ============================================================================

const mapContainerStyle = {
  width: "100%",
  height: "100%",
  borderRadius: "0.75rem", // rounded-xl
};

const defaultCenter = {
  lat: 40.7128, // Default to NY
  lng: -74.006,
};

const mapOptions: google.maps.MapOptions = {
  disableDefaultUI: false,
  zoomControl: true,
  streetViewControl: false,
  mapTypeControl: false,
  fullscreenControl: true,
  styles: [
    {
      featureType: "all",
      elementType: "labels.text.fill",
      stylers: [{ saturation: 36 }, { color: "#333333" }, { lightness: 40 }],
    },
    {
      featureType: "all",
      elementType: "labels.text.stroke",
      stylers: [{ visibility: "on" }, { color: "#ffffff" }, { lightness: 16 }],
    },
    {
      featureType: "all",
      elementType: "labels.icon",
      stylers: [{ visibility: "off" }],
    },
    {
      featureType: "administrative",
      elementType: "geometry.fill",
      stylers: [{ color: "#fefefe" }, { lightness: 20 }],
    },
    {
      featureType: "administrative",
      elementType: "geometry.stroke",
      stylers: [{ color: "#fefefe" }, { lightness: 17 }, { weight: 1.2 }],
    },
    {
      featureType: "landscape",
      elementType: "geometry",
      stylers: [{ color: "#f5f5f5" }, { lightness: 20 }],
    },
    {
      featureType: "poi",
      elementType: "geometry",
      stylers: [{ color: "#f5f5f5" }, { lightness: 21 }],
    },
    {
      featureType: "road.highway",
      elementType: "geometry.fill",
      stylers: [{ color: "#ffffff" }, { lightness: 17 }],
    },
    {
      featureType: "road.highway",
      elementType: "geometry.stroke",
      stylers: [{ color: "#e5e5e5" }, { lightness: 29 }, { weight: 0.2 }],
    },
    {
      featureType: "road.arterial",
      elementType: "geometry",
      stylers: [{ color: "#ffffff" }, { lightness: 18 }],
    },
    {
      featureType: "road.local",
      elementType: "geometry",
      stylers: [{ color: "#ffffff" }, { lightness: 16 }],
    },
    {
      featureType: "transit",
      elementType: "geometry",
      stylers: [{ color: "#f2f2f2" }, { lightness: 19 }],
    },
    {
      featureType: "water",
      elementType: "geometry",
      stylers: [{ color: "#e9e9e9" }, { lightness: 17 }],
    },
  ],
};

// Libraries must be constant
const libraries: ("places" | "geometry")[] = ["places", "geometry"];

// Polyline styles
const POLYLINE_STYLES = {
  /** Already driven portion (gray/faded) */
  driven: {
    strokeColor: "#9ca3af", // slate-400
    strokeWeight: 5,
    strokeOpacity: 0.6,
  },
  /** Remaining route (blue) */
  remaining: {
    strokeColor: "#3b82f6", // blue-500
    strokeWeight: 5,
    strokeOpacity: 0.8,
  },
  /** Deviation trail (orange) - actual path when off-route */
  deviation: {
    strokeColor: "#f97316", // orange-500
    strokeWeight: 4,
    strokeOpacity: 0.9,
  },
};

// ============================================================================
// TYPES
// ============================================================================

interface LiveMapProps {
  drivers: LiveDriver[];
  trips: LiveTrip[];
  selectedDriverId?: string | null;
  onDriverSelect: (id: string, tripId?: string) => void;
  /** Callback when route is fetched - used to cache polyline for animation */
  onRouteLoad?: (
    tripId: string,
    directions: google.maps.DirectionsResult,
    origin: string,
    destination: string,
  ) => void;
  /** Get driver's route state (for deviation display) */
  getDriverRouteState?: (driverId: string) => DriverRouteFollowingState | null;
  /** Clear reroute flag after handling */
  clearRerouteFlag?: (driverId: string) => void;
  /** Get cached route polyline for visualization */
  getRoutePolyline?: (tripId: string) => PolylinePoint[] | null;
}

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

/**
 * Map Legend Component
 */
function MapLegend() {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="absolute bottom-4 left-4 z-10">
      <div
        className={cn(
          "bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-slate-200 overflow-hidden transition-all duration-200",
          isExpanded ? "w-56" : "w-auto",
        )}
      >
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 px-3 py-2 w-full text-left hover:bg-slate-50 transition-colors"
        >
          <Info weight="duotone" className="w-4 h-4 text-slate-500" />
          <span className="text-xs font-semibold text-slate-600">
            {isExpanded ? "Map Legend" : "Legend"}
          </span>
        </button>

        {isExpanded && (
          <div className="px-3 pb-3 space-y-2.5 border-t border-slate-100 pt-2.5">
            {/* Route Colors */}
            <div className="space-y-1.5">
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                Route
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-1 rounded-full bg-slate-400" />
                <span className="text-xs text-slate-600">Already driven</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-1 rounded-full bg-blue-500" />
                <span className="text-xs text-slate-600">Remaining route</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-1 rounded-full bg-orange-500" />
                <span className="text-xs text-slate-600">Off-route path</span>
              </div>
            </div>

            {/* Driver Status */}
            <div className="space-y-1.5 pt-1">
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                Driver Status
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-blue-600 flex items-center justify-center">
                  <NavigationArrow
                    weight="fill"
                    className="w-2.5 h-2.5 text-white"
                  />
                </div>
                <span className="text-xs text-slate-600">En Route</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-amber-500 flex items-center justify-center">
                  <Warning weight="fill" className="w-2.5 h-2.5 text-white" />
                </div>
                <span className="text-xs text-slate-600">Off Route</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center">
                  <CarProfile
                    weight="fill"
                    className="w-2.5 h-2.5 text-white"
                  />
                </div>
                <span className="text-xs text-slate-600">Available</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-slate-300 flex items-center justify-center">
                  <CarProfile
                    weight="fill"
                    className="w-2.5 h-2.5 text-slate-500"
                  />
                </div>
                <span className="text-xs text-slate-600">Offline</span>
              </div>
            </div>

            {/* Markers */}
            <div className="space-y-1.5 pt-1">
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                Locations
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-[#EA4335] text-white text-[10px] font-bold flex items-center justify-center shadow-sm">
                  A
                </div>
                <span className="text-xs text-slate-600">Pickup</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-[#EA4335] text-white text-[10px] font-bold flex items-center justify-center shadow-sm">
                  B
                </div>
                <span className="text-xs text-slate-600">Dropoff</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function LiveMap({
  drivers,
  trips,
  selectedDriverId,
  onDriverSelect,
  onRouteLoad,
  getDriverRouteState,
  clearRerouteFlag,
  getRoutePolyline,
}: LiveMapProps) {
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "",
    libraries,
  });

  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [activeDriverId, setActiveDriverId] = useState<string | null>(null);
  const [directionsResponse, setDirectionsResponse] =
    useState<google.maps.DirectionsResult | null>(null);
  const [isRerouting, setIsRerouting] = useState(false);
  const [activeMarker, setActiveMarker] = useState<"pickup" | "dropoff" | null>(
    null,
  );

  // Route polyline segments for visualization
  const [drivenPath, setDrivenPath] = useState<PolylinePoint[]>([]);
  const [remainingPath, setRemainingPath] = useState<PolylinePoint[]>([]);
  /** Historical + active deviation segments for orange polylines */
  const [allDeviationPaths, setAllDeviationPaths] = useState<PolylinePoint[][]>(
    [],
  );

  // Directions cache to prevent redundant API requests
  // Key format: "tripId|origin|destination"
  const directionsCacheRef = useRef<Map<string, google.maps.DirectionsResult>>(
    new Map(),
  );

  // Track last reroute time to prevent spam
  const lastRerouteTimeRef = useRef<Map<string, number>>(new Map());

  // Use a ref for drivers to keep callbacks stable
  const driversRef = useRef(drivers);
  useEffect(() => {
    driversRef.current = drivers;
  }, [drivers]);

  // Clustering state
  const [bounds, setBounds] = useState<[number, number, number, number] | null>(
    null,
  );
  const [zoom, setZoom] = useState(10);

  const onLoad = useCallback((map: google.maps.Map) => {
    setMap(map);
  }, []);

  const onUnmount = useCallback(() => {
    setMap(null);
  }, []);

  // Update bounds/zoom on map idle
  const onMapIdle = () => {
    if (map) {
      const b = map.getBounds();
      if (b) {
        const ne = b.getNorthEast();
        const sw = b.getSouthWest();
        setBounds([sw.lng(), sw.lat(), ne.lng(), ne.lat()]);
      }
      setZoom(map.getZoom() || 10);
    }
  };

  // Prepare points for supercluster - filter out invalid coordinates
  const points = useMemo(() => {
    return drivers
      .filter(
        (d) =>
          Number.isFinite(d.lat) &&
          Number.isFinite(d.lng) &&
          (d.lat !== 0 || d.lng !== 0),
      )
      .map((d) => ({
        type: "Feature" as const,
        properties: {
          cluster: false,
          driverId: d.id,
          driver: d,
        },
        geometry: {
          type: "Point" as const,
          coordinates: [d.lng, d.lat],
        },
      }));
  }, [drivers]);

  const { clusters, supercluster } = useSupercluster({
    points,
    bounds,
    zoom,
    options: { radius: 75, maxZoom: 20 },
  });

  // Fit all drivers bounds (Zoom Out button)
  const fitAllDrivers = useCallback(() => {
    const currentDrivers = driversRef.current;
    if (map && currentDrivers.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      let hasValidLoc = false;
      currentDrivers.forEach((d: LiveDriver) => {
        bounds.extend({ lat: d.lat, lng: d.lng });
        hasValidLoc = true;
      });
      if (hasValidLoc) {
        map.fitBounds(bounds);
      }
    }
  }, [map]);

  // 1. Update active driver state when selection changes
  useEffect(() => {
    setActiveDriverId(selectedDriverId || null);
  }, [selectedDriverId]);

  // 2. Initial Pan when a driver is selected (only runs once per selection)
  useEffect(() => {
    if (selectedDriverId && map) {
      const driver = driversRef.current.find(
        (d: LiveDriver) => d.id === selectedDriverId,
      );
      if (driver) {
        map.panTo({ lat: driver.lat, lng: driver.lng });
        map.setZoom(15);
      }
    }
  }, [selectedDriverId, map]);

  // 3. Memoize routing requirements to stabilize the directions effect
  const routeParams = useMemo(() => {
    if (!selectedDriverId) return null;
    const activeTrip = trips.find(
      (t) =>
        t.driver_id === selectedDriverId &&
        (t.status === "en_route" || t.status === "in_progress"),
    );

    if (!activeTrip?.pickup_location || !activeTrip?.dropoff_location) {
      return null;
    }

    return {
      tripId: activeTrip.id,
      origin: activeTrip.pickup_location,
      destination: activeTrip.dropoff_location,
    };
  }, [selectedDriverId, trips]);

  /**
   * Fetch directions and cache the result
   * Also notifies parent to cache polyline for animation
   */
  const fetchDirections = useCallback(
    async (
      origin: string,
      destination: string,
      tripId: string,
      forceRefresh = false,
    ) => {
      // Create cache key
      const cacheKey = `${tripId}|${origin}|${destination}`;

      // Check cache first (unless forcing refresh)
      if (!forceRefresh) {
        const cached = directionsCacheRef.current.get(cacheKey);
        if (cached) {
          setDirectionsResponse(cached);
          // Notify parent about cached route
          if (onRouteLoad) {
            onRouteLoad(tripId, cached, origin, destination);
          }
          return cached;
        }
      }

      try {
        const directionsService = new google.maps.DirectionsService();
        const result = await directionsService.route({
          origin,
          destination,
          travelMode: google.maps.TravelMode.DRIVING,
        });

        if (result) {
          // Update cache (with new key if this is a reroute)
          directionsCacheRef.current.set(cacheKey, result);
          setDirectionsResponse(result);

          // Notify parent to cache polyline for animation
          if (onRouteLoad) {
            onRouteLoad(tripId, result, origin, destination);
          }

          return result;
        }
      } catch (error) {
        console.error("[LiveMap] Directions request failed:", error);
      }

      return null;
    },
    [onRouteLoad],
  );

  // 4. Fetch route when trip context changes
  useEffect(() => {
    if (routeParams) {
      fetchDirections(
        routeParams.origin,
        routeParams.destination,
        routeParams.tripId,
      );
    } else {
      setDirectionsResponse(null);
      setDrivenPath([]);
      setRemainingPath([]);
      setAllDeviationPaths([]);
    }
  }, [routeParams, fetchDirections]);

  // 5. Update polyline segments based on driver position
  useEffect(() => {
    if (!selectedDriverId || !routeParams) {
      setDrivenPath([]);
      setRemainingPath([]);
      setAllDeviationPaths([]);
      return;
    }

    const routeState = getDriverRouteState?.(selectedDriverId);
    const polyline = getRoutePolyline?.(routeParams.tripId);

    if (polyline && polyline.length > 0 && routeState) {
      const segmentIndex = routeState.segmentIndex;

      // Use actual GPS path history for the driven portion (gray) if available
      // This shows the ACTUAL path taken, not just the planned route segment
      if (
        routeState.actualPathHistory &&
        routeState.actualPathHistory.length > 1
      ) {
        setDrivenPath(routeState.actualPathHistory);
      } else {
        // Fallback: use planned route up to current segment
        const driven = polyline.slice(0, segmentIndex + 1);
        const driver = drivers.find((d) => d.id === selectedDriverId);
        if (driver) {
          driven.push({ lat: driver.lat, lng: driver.lng });
        }
        setDrivenPath(driven);
      }

      // Remaining route is always from current segment to end (blue)
      const remaining = polyline.slice(segmentIndex);
      setRemainingPath(remaining);

      // Collect all deviation paths for orange visualization
      const allDeviations: PolylinePoint[][] = [];

      // Add historical (completed) deviation segments
      if (
        routeState.completedDeviations &&
        routeState.completedDeviations.length > 0
      ) {
        allDeviations.push(...routeState.completedDeviations);
      }

      // Add current active deviation trail if off-route
      if (
        routeState.isOffRoute &&
        routeState.deviationTrail &&
        routeState.deviationTrail.length > 1
      ) {
        allDeviations.push(routeState.deviationTrail);
      }

      setAllDeviationPaths(allDeviations);
    } else if (directionsResponse) {
      // Fallback: just show the full route as remaining (blue)
      setDrivenPath([]);
      const fullPath =
        directionsResponse.routes[0]?.overview_path?.map((p) => ({
          lat: p.lat(),
          lng: p.lng(),
        })) || [];
      setRemainingPath(fullPath);
      setAllDeviationPaths([]);
    }
  }, [
    selectedDriverId,
    routeParams,
    getDriverRouteState,
    getRoutePolyline,
    drivers,
    directionsResponse,
  ]);

  // 6. Handle rerouting when driver deviates
  useEffect(() => {
    if (!selectedDriverId || !getDriverRouteState || !routeParams) return;

    const routeState = getDriverRouteState(selectedDriverId);
    if (!routeState?.rerouteRequested) return;

    // Prevent reroute spam (min 30 seconds between reroutes)
    const lastReroute = lastRerouteTimeRef.current.get(selectedDriverId) || 0;
    const now = Date.now();
    if (now - lastReroute < 30000) {
      return;
    }

    // Get driver's current position for reroute origin
    const driver = drivers.find((d) => d.id === selectedDriverId);
    if (!driver) return;

    setIsRerouting(true);
    lastRerouteTimeRef.current.set(selectedDriverId, now);

    // Reroute from driver's current position
    const newOrigin = `${driver.lat},${driver.lng}`;

    console.log(
      `[LiveMap] Rerouting driver ${selectedDriverId} from ${newOrigin} to ${routeParams.destination}`,
    );

    fetchDirections(
      newOrigin,
      routeParams.destination,
      routeParams.tripId,
      true, // Force refresh, don't use cache
    ).finally(() => {
      setIsRerouting(false);
      // Clear the reroute flag
      if (clearRerouteFlag) {
        clearRerouteFlag(selectedDriverId);
      }
    });
  }, [
    selectedDriverId,
    getDriverRouteState,
    routeParams,
    drivers,
    fetchDirections,
    clearRerouteFlag,
  ]);

  // Trigger initial fit bounds
  useEffect(() => {
    if (map && drivers.length > 0 && !selectedDriverId && !bounds) {
      fitAllDrivers();
    }
  }, [map, drivers.length, selectedDriverId, bounds, fitAllDrivers]);

  // Get active trip and stats for panel
  const activeTrip = useMemo(() => {
    if (!selectedDriverId) return null;
    return trips.find(
      (t) =>
        t.driver_id === selectedDriverId &&
        (t.status === "en_route" || t.status === "in_progress"),
    );
  }, [selectedDriverId, trips]);

  if (loadError) return <div className="p-4 text-red-500">Map Error</div>;
  if (!isLoaded)
    return <div className="w-full h-full bg-slate-100 rounded-xl" />;

  return (
    <div className="relative w-full h-full">
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={defaultCenter}
        zoom={10}
        onLoad={onLoad}
        onUnmount={onUnmount}
        onIdle={onMapIdle}
        options={mapOptions}
      >
        {/* Custom Route Polylines - driven portion (gray) */}
        {drivenPath.length > 1 && (
          <Polyline path={drivenPath} options={POLYLINE_STYLES.driven} />
        )}

        {/* Custom Route Polylines - remaining portion (blue) */}
        {remainingPath.length > 1 && (
          <Polyline path={remainingPath} options={POLYLINE_STYLES.remaining} />
        )}

        {/* All Deviation Trails - historical + active off-route paths (orange) */}
        {allDeviationPaths.map(
          (path, index) =>
            path.length > 1 && (
              <Polyline
                key={`deviation-${index}`}
                path={path}
                options={POLYLINE_STYLES.deviation}
              />
            ),
        )}

        {/* Fallback: Show directions if no custom polylines */}
        {drivenPath.length <= 1 &&
          remainingPath.length <= 1 &&
          directionsResponse && (
            <Polyline
              path={
                directionsResponse.routes[0]?.overview_path?.map((p) => ({
                  lat: p.lat(),
                  lng: p.lng(),
                })) || []
              }
              options={POLYLINE_STYLES.remaining}
            />
          )}

        {/* Pickup and Dropoff Markers (A/B) */}
        {directionsResponse && directionsResponse.routes[0]?.legs[0] && (
          <>
            <MarkerF
              position={directionsResponse.routes[0].legs[0].start_location}
              label={{
                text: "A",
                color: "white",
                fontWeight: "bold",
              }}
              onClick={() => setActiveMarker("pickup")}
            />
            {activeMarker === "pickup" && (
              <InfoWindowF
                position={directionsResponse.routes[0].legs[0].start_location}
                onCloseClick={() => setActiveMarker(null)}
              >
                <div className="p-2 min-w-[150px] bg-white rounded-lg">
                  <p className="text-sm font-bold text-slate-900">
                    Pickup Location
                  </p>
                  <p className="text-xs text-slate-600 mt-1 line-clamp-2">
                    {activeTrip?.pickup_location}
                  </p>
                  {activeTrip?.patient?.full_name && (
                    <p className="text-xs font-semibold text-blue-600 mt-1">
                      Patient: {activeTrip.patient.full_name}
                    </p>
                  )}
                </div>
              </InfoWindowF>
            )}

            <MarkerF
              position={directionsResponse.routes[0].legs[0].end_location}
              label={{
                text: "B",
                color: "white",
                fontWeight: "bold",
              }}
              onClick={() => setActiveMarker("dropoff")}
            />
            {activeMarker === "dropoff" && (
              <InfoWindowF
                position={directionsResponse.routes[0].legs[0].end_location}
                onCloseClick={() => setActiveMarker(null)}
              >
                <div className="p-2 min-w-[150px] bg-white rounded-lg">
                  <p className="text-sm font-bold text-slate-900">
                    Dropoff Location
                  </p>
                  <p className="text-xs text-slate-600 mt-1 line-clamp-2">
                    {activeTrip?.dropoff_location}
                  </p>
                </div>
              </InfoWindowF>
            )}
          </>
        )}

        {/* Clusters & Markers */}
        {clusters.map((cluster) => {
          const [longitude, latitude] = cluster.geometry.coordinates;
          const { cluster: isCluster, point_count: pointCount } =
            cluster.properties;

          if (isCluster) {
            return (
              <OverlayView
                key={`cluster-${cluster.id}`}
                position={{ lat: latitude, lng: longitude }}
                mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
              >
                <div
                  className="relative -translate-x-1/2 -translate-y-1/2 cursor-pointer z-30"
                  onClick={() => {
                    const expansionZoom = Math.min(
                      supercluster?.getClusterExpansionZoom(
                        cluster.id as number,
                      ) ?? 20,
                      20,
                    );
                    map?.setZoom(expansionZoom);
                    map?.panTo({ lat: latitude, lng: longitude });
                  }}
                >
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-600 text-white border-2 border-white shadow-lg font-bold">
                    {pointCount}
                  </div>
                </div>
              </OverlayView>
            );
          }

          // Individual Driver Marker
          const driver = cluster.properties.driver as LiveDriver;
          const isOffline = driver.status === "offline" || !driver.active;
          const isBusy = driver.status === "en_route";
          const isSelected = activeDriverId === driver.id;

          // Check if driver is off-route
          const routeState = getDriverRouteState?.(driver.id);
          const isOffRoute = routeState?.isOffRoute ?? false;

          const lastUpdate = driver.last_location_update
            ? new Date(driver.last_location_update).getTime()
            : 0;
          const timeDiff = Date.now() - lastUpdate;
          const isStale = timeDiff > 1000 * 60 * 10;

          return (
            <OverlayView
              key={driver.id}
              position={{ lat: latitude, lng: longitude }}
              mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
            >
              <div
                className="relative group cursor-pointer -translate-x-1/2 -translate-y-1/2"
                onClick={() => onDriverSelect(driver.id, driver.active_trip_id)}
              >
                {/* Visual Pulse for Busy Driver */}
                {isBusy && !isStale && (
                  <span
                    className={cn(
                      "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
                      isOffRoute ? "bg-amber-400" : "bg-blue-400",
                    )}
                  />
                )}

                <div
                  className={cn(
                    "relative flex items-center justify-center rounded-full border-2 shadow-lg transition-transform group-hover:scale-110",
                    "w-10 h-10",
                    isSelected ? "z-50 scale-125" : "z-10",
                    isOffline || isStale
                      ? "bg-slate-200 border-slate-300 text-slate-400"
                      : isOffRoute
                        ? "bg-amber-500 border-white text-white"
                        : isBusy
                          ? "bg-blue-600 border-white text-white"
                          : "bg-emerald-500 border-white text-white",
                  )}
                >
                  <div
                    className="flex items-center justify-center transition-transform duration-100 ease-linear"
                    style={{
                      transform: isBusy
                        ? `rotate(${(driver.bearing || 0) - 45}deg)`
                        : undefined,
                    }}
                  >
                    {isBusy ? (
                      isOffRoute ? (
                        <Warning weight="fill" className="w-5 h-5" />
                      ) : (
                        <NavigationArrow weight="fill" className="w-5 h-5" />
                      )
                    ) : (
                      <CarProfile weight="fill" className="w-5 h-5" />
                    )}
                  </div>
                </div>

                {/* Tooltip */}
                <div
                  className={cn(
                    "absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shadow-xl transition-all opacity-0 group-hover:opacity-100 pointer-events-none z-[60]",
                    "bg-slate-800 text-white dark:bg-white dark:text-slate-900",
                  )}
                >
                  {driver.full_name}
                  {isOffRoute && (
                    <span className="ml-1 text-amber-300 font-normal">
                      (Off Route)
                    </span>
                  )}
                  {isStale && (
                    <span className="ml-1 text-slate-400 font-normal">
                      (Stale)
                    </span>
                  )}
                </div>
              </div>
            </OverlayView>
          );
        })}
      </GoogleMap>

      {/* Map Legend */}
      <MapLegend />

      {/* Rerouting Indicator */}
      {isRerouting && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20">
          <div className="bg-amber-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            <span className="text-sm font-medium">Recalculating route...</span>
          </div>
        </div>
      )}

      {/* Fit All Button */}
      <div className="absolute top-4 right-14 z-10">
        <Button
          variant="secondary"
          size="sm"
          onClick={fitAllDrivers}
          className="shadow-md bg-white text-slate-700 hover:bg-slate-50 border border-slate-200"
          title="Fit All Drivers"
        >
          <CornersOut className="w-4 h-4 mr-2" />
          Fit All
        </Button>
      </div>
    </div>
  );
}
