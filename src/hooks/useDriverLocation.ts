import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { supabase } from "@/lib/supabase";

const UPDATE_INTERVAL = 60 * 1000; // 1 minute
const DISTANCE_THRESHOLD = 0.001; // Approx 100m in degrees (very rough)

export function useDriverLocation() {
  const { user } = useAuth();
  const [driverId, setDriverId] = useState<string | null>(null);
  const lastUpdateRef = useRef<number>(0);
  const lastPosRef = useRef<{ lat: number; lng: number } | null>(null);

  // Check if user has a driver record (works for all roles)
  useEffect(() => {
    if (!user) {
      setDriverId(null);
      return;
    }

    const checkDriverRecord = async () => {
      const { data: driverRecord } = await supabase
        .from("drivers")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (driverRecord) {
        setDriverId(driverRecord.id);
        console.log("Driver record found:", driverRecord.id);
      } else {
        console.log("No driver record for user:", user.id);
      }
    };

    checkDriverRecord();
  }, [user]);

  useEffect(() => {
    if (!user || !driverId) return;

    // Request permissions
    if (!("geolocation" in navigator)) {
      console.warn("Geolocation not supported");
      return;
    }

    console.log("Starting location tracking for driver:", driverId);

    const watchId = navigator.geolocation.watchPosition(
      async (position) => {
        const now = Date.now();
        const { latitude, longitude } = position.coords;

        // Basic throttle & distance filter
        if (
          now - lastUpdateRef.current < UPDATE_INTERVAL &&
          lastPosRef.current &&
          Math.abs(latitude - lastPosRef.current.lat) < DISTANCE_THRESHOLD &&
          Math.abs(longitude - lastPosRef.current.lng) < DISTANCE_THRESHOLD
        ) {
          return;
        }

        lastUpdateRef.current = now;
        lastPosRef.current = { lat: latitude, lng: longitude };

        try {
          // 1. Update Driver Location in DB
          const { error: driverError } = await supabase
            .from("drivers")
            .update({
              current_lat: latitude,
              current_lng: longitude,
              last_location_update: new Date().toISOString(),
            })
            .eq("id", driverId);

          if (driverError) {
            console.error("Error updating location:", driverError);
            return;
          }

          console.log("Location updated:", latitude, longitude);

          // 2. Check for Active Trip to Trigger SMS Logic
          const { data: activeTrip } = await supabase
            .from("trips")
            .select("id")
            .eq("driver_id", driverId)
            .eq("status", "in_progress")
            .maybeSingle();

          if (activeTrip) {
            console.log(
              "Active trip found, triggering ETA check:",
              activeTrip.id
            );
            // Trigger Edge Function (non-blocking)
            supabase.functions
              .invoke("send_eta_sms", {
                body: { trip_id: activeTrip.id },
              })
              .then((result) => {
                if (result.error) {
                  console.error("ETA SMS function error:", result.error);
                } else {
                  console.log("ETA check result:", result.data);
                }
              });
          }
        } catch (err) {
          console.error("Location sync error:", err);
        }
      },
      (error) => {
        console.error("Geolocation error:", error);
      },
      {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 10000,
      }
    );

    return () => {
      console.log("Stopping location tracking");
      navigator.geolocation.clearWatch(watchId);
    };
  }, [user, driverId]);
}
