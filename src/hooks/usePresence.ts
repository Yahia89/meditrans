import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/auth-context";
import { useOrganization } from "@/contexts/OrganizationContext";

type PresenceStatus = "online" | "away" | "offline";

// Heartbeat interval in milliseconds (every 30 seconds)
const HEARTBEAT_INTERVAL = 30 * 1000;
// Time before user is considered "away" (2 minutes of inactivity)
const AWAY_THRESHOLD = 2 * 60 * 1000;

/**
 * Hook to track and update user presence status in real-time
 * - Updates presence to 'online' on activity (mouse, keyboard, etc.)
 * - Updates presence to 'away' after inactivity threshold
 * - Updates presence to 'offline' on unmount/logout
 */
export function usePresence() {
  const { user } = useAuth();
  const { currentOrganization } = useOrganization();
  const lastActivityRef = useRef<number>(Date.now());
  const currentStatusRef = useRef<PresenceStatus>("offline");
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const updatePresence = useCallback(
    async (status: PresenceStatus) => {
      if (!user?.id || !currentOrganization?.id) return;

      // Don't update if status hasn't changed
      if (currentStatusRef.current === status) return;
      currentStatusRef.current = status;

      try {
        await supabase.rpc("update_user_presence", {
          p_user_id: user.id,
          p_org_id: currentOrganization.id,
          p_status: status,
        });
      } catch (error) {
        console.error("Failed to update presence:", error);
      }
    },
    [user?.id, currentOrganization?.id]
  );

  const handleActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    if (currentStatusRef.current !== "online") {
      updatePresence("online");
    }
  }, [updatePresence]);

  const checkInactivity = useCallback(() => {
    const timeSinceActivity = Date.now() - lastActivityRef.current;

    if (
      timeSinceActivity > AWAY_THRESHOLD &&
      currentStatusRef.current === "online"
    ) {
      updatePresence("away");
    }
  }, [updatePresence]);

  // Set up event listeners for user activity
  useEffect(() => {
    if (!user?.id || !currentOrganization?.id) return;

    // Initial presence update
    updatePresence("online");
    lastActivityRef.current = Date.now();

    // Activity event listeners
    const events = [
      "mousedown",
      "keydown",
      "scroll",
      "touchstart",
      "mousemove",
    ];

    // Throttle activity handler to avoid excessive updates
    let activityTimeout: ReturnType<typeof setTimeout> | null = null;
    const throttledActivity = () => {
      if (!activityTimeout) {
        handleActivity();
        activityTimeout = setTimeout(() => {
          activityTimeout = null;
        }, 5000); // Only process activity events every 5 seconds
      }
    };

    events.forEach((event) => {
      window.addEventListener(event, throttledActivity, { passive: true });
    });

    // Visibility change handler
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        handleActivity();
      } else {
        updatePresence("away");
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Before unload handler
    const handleBeforeUnload = () => {
      // Use sendBeacon for reliable offline update
      const payload = JSON.stringify({
        p_user_id: user.id,
        p_org_id: currentOrganization.id,
        p_status: "offline",
      });

      navigator.sendBeacon(
        `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/rpc/update_user_presence`,
        new Blob([payload], { type: "application/json" })
      );
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    // Heartbeat for presence and inactivity checking
    heartbeatRef.current = setInterval(() => {
      checkInactivity();
      // Also send heartbeat to keep session alive if online
      if (currentStatusRef.current === "online") {
        updatePresence("online");
      }
    }, HEARTBEAT_INTERVAL);

    // Cleanup
    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, throttledActivity);
      });
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);

      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
      }

      if (activityTimeout) {
        clearTimeout(activityTimeout);
      }

      // Mark as offline on cleanup
      updatePresence("offline");
    };
  }, [
    user?.id,
    currentOrganization?.id,
    updatePresence,
    handleActivity,
    checkInactivity,
  ]);

  return {
    updatePresence,
    setOnline: () => updatePresence("online"),
    setAway: () => updatePresence("away"),
    setOffline: () => updatePresence("offline"),
  };
}
