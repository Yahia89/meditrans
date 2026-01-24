import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { LiveDriver, LiveTrip } from "./types";
import { useOrganization } from "@/contexts/OrganizationContext";

export function useLiveTracking() {
  const { currentOrganization } = useOrganization();
  const [drivers, setDrivers] = useState<LiveDriver[]>([]);
  const [trips, setTrips] = useState<LiveTrip[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!currentOrganization?.id) return;

    try {
      // 1. Fetch Drivers
      const { data: driversData, error: driversError } = await supabase
        .from("drivers")
        .select(
          "id, full_name, current_lat, current_lng, last_location_update, active",
        )
        .eq("org_id", currentOrganization.id);

      if (driversError) throw driversError;

      // 2. Fetch Active Trips
      const { data: tripsData, error: tripsError } = await supabase
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

      if (tripsError) throw tripsError;

      // Transform trips to match LiveTrip interface
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

      // Map derived status to drivers
      const mappedDrivers: LiveDriver[] = (driversData || []).map((d) => {
        const activeTrip = formattedTrips.find((t) => t.driver_id === d.id);

        let status: LiveDriver["status"] = "idle";
        if (!d.active) status = "offline";
        else if (activeTrip) status = "en_route"; // Simplified; distinguishing en_route vs in_progress if needed

        return {
          ...d,
          status,
          active_trip_id: activeTrip?.id,
        };
      });

      setDrivers(mappedDrivers);
      setTrips(formattedTrips);
    } catch (err) {
      console.error("Error fetching live tracking data:", err);
    } finally {
      setLoading(false);
    }
  }, [currentOrganization?.id]);

  // Initial Load
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Realtime Subscriptions
  useEffect(() => {
    if (!currentOrganization?.id) return;

    const channel = supabase
      .channel("live-tracking")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "drivers",
          filter: `org_id=eq.${currentOrganization.id}`,
        },
        (payload) => {
          // Optimistic update for driver location
          setDrivers((prev) =>
            prev.map((d) => {
              if (d.id === payload.new.id) {
                return {
                  ...d,
                  current_lat: payload.new.current_lat,
                  current_lng: payload.new.current_lng,
                  last_location_update: payload.new.last_location_update,
                  active: payload.new.active,
                };
              }
              return d;
            }),
          );
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*", // Listen to INSERT/UPDATE/DELETE for trips
          schema: "public",
          table: "trips",
          filter: `org_id=eq.${currentOrganization.id}`,
        },
        () => {
          // Refetch everything on trip changes to keep derived state clean
          // Debounce could be good here but keeping it simple for now
          fetchData();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentOrganization?.id, fetchData]);

  return { drivers, trips, loading };
}
