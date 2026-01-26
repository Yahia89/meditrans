import { useCallback, useState, useEffect, useMemo, useRef } from "react";
import {
  GoogleMap,
  useLoadScript,
  OverlayView,
  DirectionsRenderer,
} from "@react-google-maps/api";
import useSupercluster from "use-supercluster";
import type { LiveDriver, LiveTrip } from "./types";
import { NavigationArrow, CarProfile, CornersOut } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const mapContainerStyle = {
  width: "100%",
  height: "100%",
  borderRadius: "0.75rem", // rounded-xl
};

const defaultCenter = {
  lat: 40.7128, // Default to NY or user's preference if available?
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

interface LiveMapProps {
  drivers: LiveDriver[];
  trips: LiveTrip[];
  selectedDriverId?: string | null;
  onDriverSelect: (id: string, tripId?: string) => void;
}

export function LiveMap({
  drivers,
  trips,
  selectedDriverId,
  onDriverSelect,
}: LiveMapProps) {
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "",
    libraries,
  });

  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [activeDriverId, setActiveDriverId] = useState<string | null>(null);
  const [directionsResponse, setDirectionsResponse] =
    useState<google.maps.DirectionsResult | null>(null);

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

  // Prepare points for supercluster
  const points = useMemo(() => {
    return drivers.map((d) => ({
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

  // 4. Fetch route only when trip context changes (Origin/Destination/TripID)
  useEffect(() => {
    if (routeParams) {
      const directionsService = new google.maps.DirectionsService();
      directionsService.route(
        {
          origin: routeParams.origin,
          destination: routeParams.destination,
          travelMode: google.maps.TravelMode.DRIVING,
        },
        (result, status) => {
          if (status === google.maps.DirectionsStatus.OK) {
            setDirectionsResponse(result);
          } else {
            console.error("Directions request failed:", status);
            setDirectionsResponse(null);
          }
        },
      );
    } else {
      setDirectionsResponse(null);
    }
  }, [routeParams]);

  // Trigger initial fit bounds
  useEffect(() => {
    if (map && drivers.length > 0 && !selectedDriverId && !bounds) {
      fitAllDrivers();
    }
  }, [map, drivers.length, selectedDriverId, bounds, fitAllDrivers]);

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
        {/* Route Line */}
        {directionsResponse && (
          <DirectionsRenderer
            directions={directionsResponse}
            options={{
              suppressMarkers: false,
              polylineOptions: {
                strokeColor: "#3b82f6",
                strokeWeight: 5,
                strokeOpacity: 0.7,
              },
              preserveViewport: false,
            }}
          />
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
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
                )}

                <div
                  className={cn(
                    "relative flex items-center justify-center rounded-full border-2 shadow-lg transition-transform group-hover:scale-110",
                    "w-10 h-10",
                    isSelected ? "z-50 scale-125" : "z-10",
                    isOffline || isStale
                      ? "bg-slate-200 border-slate-300 text-slate-400"
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
                      <NavigationArrow weight="fill" className="w-5 h-5" />
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
