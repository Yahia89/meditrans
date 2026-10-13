import { useEffect } from "react";
import { useAuth } from "@/contexts/auth-context";
import { useOrganization } from "@/contexts/OrganizationContext";
import { supabase } from "@/lib/supabase";

const UPDATE_INTERVAL = 60 * 1000;
const DISTANCE_THRESHOLD = 0.001;
const ETA_CHECK_TIMEOUT = 30 * 1000;

/** Read-only shared identity. A confirmed missing driver never starts a new read. */
export function useDriverIdentity() {
  const { user, bootstrap, loading: authLoading } = useAuth();
  const { currentOrganization, loading: orgLoading } = useOrganization();
  const driver = !authLoading && !orgLoading ? bootstrap?.drivers.find((record) =>
    record.user_id === user?.id && record.org_id === currentOrganization?.id) ?? null : null;
  return { driverId: driver?.id ?? null, driver, loading: authLoading || orgLoading };
}

/** Mounted once by App, enabled only for an authorized driving workflow. */
export function useDriverLocation({ enabled = false }: { enabled?: boolean } = {}) {
  const { driverId, driver } = useDriverIdentity();
  const { userRole } = useOrganization();
  const orgId = driver?.org_id;
  const userId = driver?.user_id;
  const canTrack = enabled && !!driver?.active && !driver.disabled_at && ["owner", "admin", "dispatch", "driver"].includes(userRole ?? "");

  useEffect(() => {
    if (!canTrack || !driverId || !orgId || !userId || !("geolocation" in navigator)) return;
    const controller = new AbortController();
    let active = true;
    let updating = false;
    let lastUpdate = 0;
    let lastPosition: { lat: number; lng: number } | null = null;
    let etaController: AbortController | null = null;
    const checkEta = async () => {
      if (!active || etaController) return;
      const taskController = new AbortController();
      etaController = taskController;
      const timeout = setTimeout(() => taskController.abort(), ETA_CHECK_TIMEOUT);
      try {
        const { data: activeTrip, error: tripError } = await supabase.from("trips").select("id")
          .eq("org_id", orgId).eq("driver_id", driverId).eq("status", "en_route")
          .abortSignal(taskController.signal).maybeSingle();
        if (active && !taskController.signal.aborted && !tripError && activeTrip) {
          await supabase.functions.invoke("send_eta_sms", { body: { trip_id: activeTrip.id }, signal: taskController.signal });
        }
      } catch {
        if (active && !taskController.signal.aborted) console.warn("Unable to check driver ETA.");
      } finally {
        clearTimeout(timeout);
        etaController = null;
      }
    };
    const watchId = navigator.geolocation.watchPosition(async (position) => {
      if (!active || updating) return;
      const now = Date.now();
      const { latitude, longitude } = position.coords;
      if (now - lastUpdate < UPDATE_INTERVAL && lastPosition &&
        Math.abs(latitude - lastPosition.lat) < DISTANCE_THRESHOLD &&
        Math.abs(longitude - lastPosition.lng) < DISTANCE_THRESHOLD) return;
      updating = true;
      try {
        const { error } = await supabase.from("drivers").update({
          current_lat: latitude, current_lng: longitude,
          last_location_update: new Date().toISOString(),
        }).eq("id", driverId).eq("org_id", orgId).eq("user_id", userId).abortSignal(controller.signal);
        if (error || !active) return;
        lastUpdate = now;
        lastPosition = { lat: latitude, lng: longitude };
        // One bounded ETA task may run independently; a slow SMS service must
        // never hold the location-write lock or accumulate duplicate checks.
        void checkEta();
      } catch {
        // A stopped watch must never continue into ETA/SMS for the old identity.
        if (active) console.warn("Unable to sync driver location.");
      } finally { updating = false; }
    }, () => {
      if (active) console.warn("Driver location is unavailable.");
    }, { enableHighAccuracy: true, timeout: 20000, maximumAge: 10000 });
    return () => {
      active = false;
      controller.abort();
      etaController?.abort();
      navigator.geolocation.clearWatch(watchId);
    };
  }, [canTrack, driverId, orgId, userId]);

  return { driverId };
}
