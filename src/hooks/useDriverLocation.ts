import { useEffect, useRef } from "react";
import { useAuth } from "@/contexts/auth-context";
import { useOrganization } from "@/contexts/OrganizationContext";
import { supabase } from "@/lib/supabase";

const UPDATE_INTERVAL = 60 * 1000; // 1 minute
const DISTANCE_THRESHOLD = 0.001; // Approx 100m in degrees (very rough)

export function useDriverLocation() {
  const { user } = useAuth();
  const { userRole } = useOrganization();
  const lastUpdateRef = useRef<number>(0);
  const lastPosRef = useRef<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!user || userRole !== "driver") return;

    // Request permissions
    if (!("geolocation" in navigator)) {
      console.warn("Geolocation not supported");
      return;
    }

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
          // 1. First, get the driver record for this user
          const { data: driverRecord, error: driverFetchError } = await supabase
            .from("drivers")
            .select("id")
            .eq("user_id", user.id)
            .single();

          if (driverFetchError || !driverRecord) {
            console.error(
              "Driver record not found for user:",
              user.id,
              driverFetchError
            );
            return;
          }

          // 2. Update Driver Location in DB
          const { error: driverError } = await supabase
            .from("drivers")
            .update({
              current_lat: latitude,
              current_lng: longitude,
              last_location_update: new Date().toISOString(),
            })
            .eq("id", driverRecord.id);

          if (driverError) {
            console.error("Error updating location:", driverError);
            return;
          }

          // 3. Check for Active Trip to Trigger SMS Logic
          const { data: activeTrip } = await supabase
            .from("trips")
            .select("id")
            .eq("driver_id", driverRecord.id)
            .eq("status", "in_progress")
            .maybeSingle();

          if (activeTrip) {
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

    return () => navigator.geolocation.clearWatch(watchId);
  }, [user, userRole]);
}
