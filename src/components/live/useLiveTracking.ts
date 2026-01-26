import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useOrganization } from "@/contexts/OrganizationContext";
import { interpolateLatLng, calculateBearing } from "@/lib/geo";
import type { LiveDriver, LiveTrip } from "./types";

export function useLiveTracking() {
  const { currentOrganization } = useOrganization();
  const [drivers, setDrivers] = useState<LiveDriver[]>([]);
  const [trips, setTrips] = useState<LiveTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const rafRef = useRef<number | null>(null);

  // Animate loop
  useEffect(() => {
    function tick() {
      setDrivers((prev) =>
        prev.map((d) => {
          if (!d.target) return d;

          // Simple threshold to stop animating when "close enough"
          const distSq =
            Math.pow(d.lat - d.target.lat, 2) +
            Math.pow(d.lng - d.target.lng, 2);
          if (distSq < 0.000000001) return d;

          const next = interpolateLatLng(
            { lat: d.lat, lng: d.lng },
            d.target,
            0.15, // smoothing factor
          );

          return {
            ...d,
            lat: next.lat,
            lng: next.lng,
            bearing: calculateBearing({ lat: d.lat, lng: d.lng }, d.target),
          };
        }),
      );

      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Initial fetch
  useEffect(() => {
    if (!currentOrganization?.id) return;

    (async () => {
      try {
        const { data: driversData } = await supabase
          .from("drivers")
          .select(
            "id, full_name, current_lat, current_lng, last_location_update, active",
          )
          .eq("org_id", currentOrganization.id);

        const { data: tripsData } = await supabase
          .from("trips")
          .select(
            `
            id, 
            status, 
            driver_id, 
            pickup_location, 
            dropoff_location, 
            pickup_time,
            patient:patients(full_name),
            driver:drivers(full_name)
          `,
          )
          .eq("org_id", currentOrganization.id)
          .in("status", ["en_route", "in_progress"]);

        const formattedTrips: LiveTrip[] = (tripsData || []).map((t: any) => ({
          id: t.id,
          status: t.status,
          driver_id: t.driver_id,
          pickup_location: t.pickup_location,
          dropoff_location: t.dropoff_location,
          pickup_time: t.pickup_time,
          patient: t.patient,
          driver: t.driver,
        }));

        setDrivers(
          (driversData || []).map((d) => {
            const activeTrip = formattedTrips.find((t) => t.driver_id === d.id);
            let status: LiveDriver["status"] = "idle";
            if (!d.active) status = "offline";
            else if (activeTrip) status = "en_route";

            const lat = d.current_lat || 0;
            const lng = d.current_lng || 0;

            return {
              ...d,
              lat,
              lng,
              target: { lat, lng },
              bearing: 0,
              status,
              active_trip_id: activeTrip?.id,
            };
          }),
        );

        setTrips(formattedTrips);
      } catch (err) {
        console.error("Error fetching live tracking data:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [currentOrganization?.id]);

  // Realtime
  useEffect(() => {
    if (!currentOrganization?.id) return;

    const channel = supabase
      .channel("drivers-live")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "drivers",
          filter: `org_id=eq.${currentOrganization.id}`,
        },
        (payload) => {
          setDrivers((prev) =>
            prev.map((d) =>
              d.id === payload.new.id
                ? {
                    ...d,
                    target: {
                      lat: payload.new.current_lat,
                      lng: payload.new.current_lng,
                    },
                    current_lat: payload.new.current_lat,
                    current_lng: payload.new.current_lng,
                    last_location_update: payload.new.last_location_update,
                    active: payload.new.active,
                  }
                : d,
            ),
          );
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "trips",
          filter: `org_id=eq.${currentOrganization.id}`,
        },
        () => {
          // Keep it simple and just refetch trips when they change
          // (In a very high traffic app you'd want to be more surgical)
          supabase
            .from("trips")
            .select(
              `
              id, status, driver_id, pickup_location, dropoff_location, pickup_time,
              patient:patients(full_name), driver:drivers(full_name)
            `,
            )
            .eq("org_id", currentOrganization.id)
            .in("status", ["en_route", "in_progress"])
            .then(({ data }) => {
              if (data) {
                const formatted = data.map((t: any) => ({
                  id: t.id,
                  status: t.status,
                  driver_id: t.driver_id,
                  pickup_location: t.pickup_location,
                  dropoff_location: t.dropoff_location,
                  pickup_time: t.pickup_time,
                  patient: t.patient,
                  driver: t.driver,
                }));
                setTrips(formatted);
              }
            });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentOrganization?.id]);

  return { drivers, trips, loading };
}
