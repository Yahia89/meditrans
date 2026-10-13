import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/auth-context";
import { useOrganization } from "@/contexts/OrganizationContext";

type PresenceStatus = "online" | "away" | "offline";
const HEARTBEAT_INTERVAL = 30 * 1000;
const AWAY_THRESHOLD = 2 * 60 * 1000;

/** One lifecycle per resolved user/company. Cleanup always owns its original IDs. */
export function usePresence() {
  const { user, session, loading: authLoading, error: authError } = useAuth();
  const { currentOrganization, loading: orgLoading, error: orgError } = useOrganization();
  const userId = user?.id;
  const orgId = currentOrganization?.id;
  const ready = !authLoading && !orgLoading && !authError && !orgError;
  const sessionRef = useRef(session);
  const statusSetter = useRef<((status: PresenceStatus) => void) | null>(null);
  useEffect(() => { sessionRef.current = session; }, [session]);

  useEffect(() => {
    if (!ready || !userId || !orgId) return;
    let disposed = false;
    let started = false;
    let currentStatus: PresenceStatus = "offline";
    let lastActivity = Date.now();
    let activityTimeout: ReturnType<typeof setTimeout> | null = null;
    const tokenAtSetup = sessionRef.current?.access_token;

    const updatePresence = async (status: PresenceStatus, force = false) => {
      if (disposed || (!force && currentStatus === status)) return;
      currentStatus = status;
      try {
        const { error } = await supabase.rpc("update_user_presence", {
          p_user_id: userId, p_org_id: orgId, p_status: status,
        });
        if (error && !disposed) console.warn("Unable to update presence.");
      } catch { if (!disposed) console.warn("Unable to update presence."); }
    };

    // Authenticated keepalive can send Authorization; sendBeacon cannot. Never
    // put API keys/tokens in URLs, and never pair another user's token with IDs.
    const sendOffline = () => {
      const currentSession = sessionRef.current;
      const token = currentSession?.user.id === userId ? currentSession.access_token : tokenAtSetup;
      if (!token || !started) return;
      void fetch(`${import.meta.env.VITE_SUPABASE_URL}/rest/v1/rpc/update_user_presence`, {
        method: "POST", keepalive: true,
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ p_user_id: userId, p_org_id: orgId, p_status: "offline" }),
      }).catch(() => { /* Server expiry handles browsers that abort unloading. */ });
    };

    const handleActivity = () => {
      lastActivity = Date.now();
      if (document.visibilityState === "visible") void updatePresence("online");
    };
    const throttledActivity = () => {
      if (activityTimeout) return;
      handleActivity();
      activityTimeout = setTimeout(() => { activityTimeout = null; }, 5000);
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") handleActivity();
      else void updatePresence("away");
    };
    const events = ["mousedown", "keydown", "scroll", "touchstart", "mousemove"] as const;
    events.forEach((event) => window.addEventListener(event, throttledActivity, { passive: true }));
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", sendOffline);
    statusSetter.current = (status) => { void updatePresence(status); };

    // StrictMode can dispose its first mount before this work starts.
    queueMicrotask(() => {
      if (disposed) return;
      started = true;
      void updatePresence(document.visibilityState === "visible" ? "online" : "away", true);
    });
    const heartbeat = setInterval(() => {
      if (currentStatus === "offline") return;
      const status = document.visibilityState !== "visible" || Date.now() - lastActivity > AWAY_THRESHOLD
        ? "away" : currentStatus;
      void updatePresence(status, true);
    }, HEARTBEAT_INTERVAL);

    return () => {
      disposed = true;
      statusSetter.current = null;
      events.forEach((event) => window.removeEventListener(event, throttledActivity));
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", sendOffline);
      clearInterval(heartbeat);
      if (activityTimeout) clearTimeout(activityTimeout);
      sendOffline();
    };
  }, [userId, orgId, ready]);

  return {
    setOnline: () => statusSetter.current?.("online"),
    setAway: () => statusSetter.current?.("away"),
    setOffline: () => statusSetter.current?.("offline"),
  };
}
