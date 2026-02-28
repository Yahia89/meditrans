import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/auth-context";
import { useOrganization } from "@/contexts/OrganizationContext";

type PresenceStatus = "online" | "away" | "offline";

// Heartbeat interval in milliseconds (every 30 seconds)
const HEARTBEAT_INTERVAL = 30 * 1000;
// Time before user is considered "away" (2 minutes of inactivity)
const AWAY_THRESHOLD = 2 * 60 * 1000;

/**
 * Global presence tracking hook - called once at the App level.
 *
 * Key design decisions:
 * 1. Uses refs for user/org IDs so the effect never re-runs on identity changes
 *    (prevents teardown → "offline" → re-setup → "online" flicker).
 * 2. Heartbeat unconditionally writes to DB (bypasses the "same status" guard)
 *    so that `last_active_at` is always refreshed. This lets a server-side
 *    cleanup function detect stale sessions.
 * 3. `sendBeacon` includes the required `apikey` header so offline updates
 *    actually reach Supabase when the tab/browser is closed.
 * 4. The effect only depends on stable boolean "is ready" — not on callbacks.
 */
export function usePresence() {
  const { user } = useAuth();
  const { currentOrganization } = useOrganization();

  // Stable refs so event handlers always see current values without
  // causing the effect to re-run.
  const userIdRef = useRef<string | null>(null);
  const orgIdRef = useRef<string | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const currentStatusRef = useRef<PresenceStatus>("offline");
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isSetupRef = useRef(false);

  // Keep refs in sync
  userIdRef.current = user?.id ?? null;
  orgIdRef.current = currentOrganization?.id ?? null;

  useEffect(() => {
    const userId = userIdRef.current;
    const orgId = orgIdRef.current;

    if (!userId || !orgId) return;

    // Prevent double-setup from strict mode / fast re-renders
    if (isSetupRef.current) return;
    isSetupRef.current = true;

    // ── Helpers ────────────────────────────────────────────────────
    const updatePresence = async (status: PresenceStatus, force = false) => {
      const uid = userIdRef.current;
      const oid = orgIdRef.current;
      if (!uid || !oid) return;

      // Skip no-op updates (unless forced by heartbeat)
      if (!force && currentStatusRef.current === status) return;
      currentStatusRef.current = status;

      try {
        await supabase.rpc("update_user_presence", {
          p_user_id: uid,
          p_org_id: oid,
          p_status: status,
        });
      } catch (error) {
        console.error("Failed to update presence:", error);
      }
    };

    const handleActivity = () => {
      lastActivityRef.current = Date.now();
      if (currentStatusRef.current !== "online") {
        updatePresence("online");
      }
    };

    const checkInactivity = () => {
      const timeSinceActivity = Date.now() - lastActivityRef.current;
      if (
        timeSinceActivity > AWAY_THRESHOLD &&
        currentStatusRef.current === "online"
      ) {
        updatePresence("away");
      }
    };

    // ── Initial online ───────────────────────────────────────────
    updatePresence("online", true);
    lastActivityRef.current = Date.now();

    // ── Activity listeners (throttled) ───────────────────────────
    const events = [
      "mousedown",
      "keydown",
      "scroll",
      "touchstart",
      "mousemove",
    ] as const;

    let activityTimeout: ReturnType<typeof setTimeout> | null = null;
    const throttledActivity = () => {
      if (!activityTimeout) {
        handleActivity();
        activityTimeout = setTimeout(() => {
          activityTimeout = null;
        }, 5000);
      }
    };

    events.forEach((event) => {
      window.addEventListener(event, throttledActivity, { passive: true });
    });

    // ── Visibility change ────────────────────────────────────────
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        handleActivity();
      } else {
        updatePresence("away");
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // ── Before unload (reliable offline via sendBeacon) ──────────
    const handleBeforeUnload = () => {
      const uid = userIdRef.current;
      const oid = orgIdRef.current;
      if (!uid || !oid) return;

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      // sendBeacon with Blob doesn't support custom headers,
      // so we pass the apikey as a query parameter and use a
      // JSON blob. The Supabase REST API accepts apikey in the header
      // OR as a query parameter.
      const url = `${supabaseUrl}/rest/v1/rpc/update_user_presence?apikey=${encodeURIComponent(supabaseKey)}`;

      const payload = JSON.stringify({
        p_user_id: uid,
        p_org_id: oid,
        p_status: "offline",
      });

      navigator.sendBeacon(
        url,
        new Blob([payload], { type: "application/json" }),
      );
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    // ── Heartbeat ────────────────────────────────────────────────
    // force=true so the DB write always happens (refreshes last_active_at)
    heartbeatRef.current = setInterval(() => {
      checkInactivity();
      // Always force-write current status to refresh last_active_at
      if (currentStatusRef.current !== "offline") {
        updatePresence(currentStatusRef.current, true);
      }
    }, HEARTBEAT_INTERVAL);

    // ── Cleanup ──────────────────────────────────────────────────
    return () => {
      isSetupRef.current = false;

      events.forEach((event) => {
        window.removeEventListener(event, throttledActivity);
      });
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);

      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }

      if (activityTimeout) {
        clearTimeout(activityTimeout);
      }

      // Mark as offline on cleanup
      updatePresence("offline", true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!user?.id, !!currentOrganization?.id]);

  return {
    setOnline: () => {
      if (userIdRef.current && orgIdRef.current) {
        currentStatusRef.current = "online";
        supabase.rpc("update_user_presence", {
          p_user_id: userIdRef.current,
          p_org_id: orgIdRef.current,
          p_status: "online",
        });
      }
    },
    setAway: () => {
      if (userIdRef.current && orgIdRef.current) {
        currentStatusRef.current = "away";
        supabase.rpc("update_user_presence", {
          p_user_id: userIdRef.current,
          p_org_id: orgIdRef.current,
          p_status: "away",
        });
      }
    },
    setOffline: () => {
      if (userIdRef.current && orgIdRef.current) {
        currentStatusRef.current = "offline";
        supabase.rpc("update_user_presence", {
          p_user_id: userIdRef.current,
          p_org_id: orgIdRef.current,
          p_status: "offline",
        });
      }
    },
  };
}
